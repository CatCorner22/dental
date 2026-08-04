import { runPhiRule } from "@/lib/audit/rules/phi";
import { retrieveContext } from "./retrieval";
import { verifyMeaning, type VerifyRejection } from "@/lib/verify/verifyMeaning";
import {
  ASSIST_PROMPT_VERSION,
  SYSTEM_PROMPTS,
  type AssistCapability
} from "./prompts";
import {
  CONFLICTS_SCHEMA,
  QUESTIONS_SCHEMA,
  conflictsToLines,
  validateConflicts,
  validateQuestions
} from "./schemas";
import {
  EXTRACTION_SCHEMA,
  validateExtraction,
  verifyExtraction,
  type VerifiedExtraction
} from "./extraction";

// The assist service: one narrow doorway through which every AI call passes.
//
//   text in ──► PHI gate ──► model ──► meaning verifier ──► human review
//
// Three properties, each enforced here rather than promised in a prompt:
//  1. NOTHING PHI-FLAGGED LEAVES. The same deterministic PHI rules that gate
//     export gate the model call. A prompt asking the model to refuse is a
//     courtesy; this check is the enforcement.
//  2. THE MODEL'S OUTPUT IS EVIDENCE, NOT TRUTH. verifyMeaning rejects any
//     output that differs from the input in clinical substance, and the
//     rejection reason is shown to the user — the tool checking its own work
//     in public is what makes the AI trustworthy enough to use.
//  3. THE MODEL IS INJECTABLE. Production binds the Vercel AI SDK; tests bind
//     an adversary. The service cannot tell the difference, which is the
//     point — its guarantees cannot depend on the model behaving.

export interface AssistConfig {
  enabled: boolean;
  model: string;
}

export function getAssistConfig(
  env: Record<string, string | undefined> = process.env
): AssistConfig {
  return {
    // Two switches on purpose: a key present but ASSIST_ENABLED unset means
    // an operator added credentials without turning the feature on — the
    // feature stays off. AI is opt-in per deployment, never ambient.
    enabled: env.ASSIST_ENABLED === "1" && Boolean(env.AI_GATEWAY_API_KEY),
    model: env.ASSIST_MODEL || "anthropic/claude-sonnet-4.5"
  };
}

export type GenerateFn = (args: { system: string; prompt: string }) => Promise<string>;

/**
 * The structured seam, for capabilities whose answer is a LIST.
 *
 * Separate from GenerateFn rather than folded into it, because the two return
 * genuinely different things and a union return type would push the branch into
 * every caller. Injected the same way, so the adversarial test double can lie in
 * this direction too — returning the wrong shape, an assertion dressed as a
 * question, or a conflict between a sentence and itself.
 */
export type GenerateListFn = (args: {
  system: string;
  prompt: string;
  schemaName: string;
  schema: Record<string, unknown>;
}) => Promise<unknown>;

export type AssistOutcome =
  | {
      ok: true;
      text: string;
      capability: AssistCapability;
      promptVersion: string;
      /** Which practice-standards sections were retrieved into the prompt. */
      retrievedSources: string[];
      /**
       * Set for the list capabilities. `text` stays populated (one item per
       * line) so the verifier and any plain-text consumer keep working, but the
       * UI should render THIS — it is the validated structure rather than a
       * string somebody has to split again.
       */
      items?: string[];
      /**
       * Set for the extract capability: the span-verified result. Per-fact
       * refusals live INSIDE a successful outcome — refusing one fabricated
       * fact while pinning four honest ones is the design, not a failure.
       */
      extraction?: VerifiedExtraction;
      /**
       * Refusal codes that occurred within a successful outcome (extract's
       * per-fact refusals), so the drift row has its one field to read on the
       * ok path too. A climbing per-fact refusal rate is the earliest sign a
       * model revision changed under the practice.
       */
      codes?: string[];
    }
  | {
      ok: false;
      code: "phi-blocked" | "verifier-rejected" | "model-error" | "invalid-shape";
      /** Cold logic for the user: what stopped the call and what to do. */
      message: string;
      rejections?: VerifyRejection[];
      /**
       * Machine-readable reasons, uniform across every failure kind: verifier
       * rejection codes, or the PHI rule ids that blocked the call.
       *
       * Exists so the drift monitor has ONE field to read instead of a switch on
       * `code`. Every value is a constant from this codebase — a rule name — and
       * never anything derived from the text, which is what keeps "no note content
       * is ever logged" true while still making the signal legible.
       */
      codes: string[];
    };

const MAX_INPUT = 20000;

export async function runAssist(
  capability: AssistCapability,
  text: string,
  generate: GenerateFn,
  generateList?: GenerateListFn
): Promise<AssistOutcome> {
  const input = text.slice(0, MAX_INPUT);

  // PHI gate. ANY phi finding blocks the call — not only S0. Bare-name hits
  // are S2 for the in-app audit (review, not hard-stop on filing), but an AI
  // provider is off-server: probable patient names must never leave either.
  const phi = runPhiRule(input).filter((f) => f.category === "phi");
  if (phi.length > 0) {
    const stops = phi.filter((f) => f.severity === "S0").length;
    return {
      ok: false,
      code: "phi-blocked",
      codes: [...new Set(phi.map((f) => f.ruleId))].sort(),
      message:
        `The AI was not called. ${phi.length} possible identifier${phi.length === 1 ? "" : "s"} ` +
        `must be removed or masked first — de-identified text is the condition for any AI ` +
        `assistance, with no exception and no override. ` +
        // Says WHY the same finding is a review elsewhere and a stop here. Without
        // it, a staff member who has just seen the audit call this an S2 REVIEW
        // reads the block as the tool contradicting itself, and a rule that looks
        // arbitrary is a rule that gets worked around.
        (stops < phi.length
          ? `Some of these are flagged for review rather than blocked elsewhere in the app; ` +
            `sending text to an outside provider cannot be reviewed afterwards, so here they stop the call.`
          : `Use Mask identifiers, or edit the text, then try again.`)
    };
  }

  // Retrieval: the practice's own standards, selected by what the text
  // actually contains, appended to the system prompt. Read from the same
  // tables the deterministic pass enforces, so it can never drift from them.
  const retrieved = retrieveContext(input);
  const system = retrieved.text
    ? `${SYSTEM_PROMPTS[capability]}\n\n--- PRACTICE STANDARDS (retrieved for this text) ---\n${retrieved.text}`
    : SYSTEM_PROMPTS[capability];

  // EXTRACT SHORT-CIRCUITS THE SHARED TAIL, deliberately. Its verifier is
  // per-fact and stricter than verifyMeaning — every statement must ground in
  // its own verbatim quote, a SUBSET of the input — and running the whole-text
  // verifier over a fact list would refuse honest extractions for "dropping"
  // the rest of the note, which is what an extraction is FOR.
  if (capability === "extract") {
    if (!generateList) {
      return {
        ok: false,
        code: "model-error",
        codes: [],
        message:
          "This capability needs the structured model binding, which this deployment did not provide. The deterministic tools still work."
      };
    }
    let value: unknown;
    try {
      value = await generateList({
        system,
        prompt: input,
        schemaName: "ExtractedFacts",
        schema: EXTRACTION_SCHEMA
      });
    } catch {
      return {
        ok: false,
        code: "model-error",
        codes: [],
        message:
          "The AI service did not answer. The deterministic tools still work — continue without it."
      };
    }
    const parsed = validateExtraction(value);
    if (!parsed.ok) {
      return {
        ok: false,
        code: "invalid-shape",
        codes: [],
        message: `The AI's answer did not match the agreed shape (${parsed.reason}), so it was not shown. Your text is untouched.`
      };
    }
    const extraction = verifyExtraction(input, parsed.facts);
    return {
      ok: true,
      // One pinned statement per line, so plain-text consumers keep working.
      text: extraction.pinned.map((f) => f.statement).join("\n"),
      capability,
      promptVersion: ASSIST_PROMPT_VERSION,
      retrievedSources: retrieved.sources,
      extraction,
      codes: [...new Set(extraction.refused.map((r) => r.code))].sort()
    };
  }

  const isList = capability === "interrogate" || capability === "conflicts";

  // The list capabilities go through a SCHEMA, not through prose.
  //
  // Constrained decoding fixes the shape; the validators below fix the rest,
  // because a schema cannot tell a question from an assertion wearing a question
  // mark's clothes. Both layers report the same way, so a malformed answer is a
  // stated refusal rather than a UI that renders "Here are the questions:" as
  // the first question.
  let output: string;
  let items: string[] | undefined;
  if (isList) {
    if (!generateList) {
      return {
        ok: false,
        code: "model-error",
        codes: [],
        message:
          "This capability needs the structured model binding, which this deployment did not provide. The deterministic tools still work."
      };
    }
    let value: unknown;
    try {
      value = await generateList({
        system,
        prompt: input,
        schemaName: capability === "interrogate" ? "OpenQuestions" : "Contradictions",
        schema: capability === "interrogate" ? QUESTIONS_SCHEMA : CONFLICTS_SCHEMA
      });
    } catch {
      return {
        ok: false,
        code: "model-error",
        codes: [],
        message:
          "The AI service did not answer. The deterministic tools still work — continue without it."
      };
    }
    if (capability === "interrogate") {
      const parsed = validateQuestions(value);
      if (!parsed.ok) {
        return {
          ok: false,
          code: "invalid-shape",
          codes: [],
          message: `The AI's answer did not match the agreed shape (${parsed.reason}), so it was not shown. Your text is untouched.`
        };
      }
      items = parsed.items;
    } else {
      const parsed = validateConflicts(value);
      if (!parsed.ok) {
        return {
          ok: false,
          code: "invalid-shape",
          codes: [],
          message: `The AI's answer did not match the agreed shape (${parsed.reason}), so it was not shown. Your text is untouched.`
        };
      }
      items = conflictsToLines(parsed.items);
    }
    output = items.join("\n");
  } else {
    let raw: string;
    try {
      raw = await generate({ system, prompt: input });
    } catch {
      return {
        ok: false,
        code: "model-error",
        codes: [],
        message:
          "The AI service did not answer. The deterministic tools still work — continue without it."
      };
    }
    output = raw.trim();
  }

  const mode = isList ? "questions" : "rewrite";
  const verdict = verifyMeaning(input, output, { mode });
  if (!verdict.ok) {
    return {
      ok: false,
      code: "verifier-rejected",
      codes: [...new Set(verdict.rejections.map((r) => r.code))].sort(),
      message:
        `The AI's draft was refused before you saw it: it differed from your note in clinical ` +
        `substance (${verdict.rejections.map((r) => r.code).join(", ")}). This is the check ` +
        `working, not the tool failing — your original text is untouched.`,
      rejections: verdict.rejections
    };
  }

  return {
    ok: true,
    text: output,
    capability,
    promptVersion: ASSIST_PROMPT_VERSION,
    retrievedSources: retrieved.sources,
    ...(items ? { items } : {})
  };
}
