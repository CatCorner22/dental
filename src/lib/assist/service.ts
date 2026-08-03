import { runPhiRule } from "@/lib/audit/rules/phi";
import { retrieveContext } from "./retrieval";
import { verifyMeaning, type VerifyRejection } from "@/lib/verify/verifyMeaning";
import {
  ASSIST_PROMPT_VERSION,
  SYSTEM_PROMPTS,
  type AssistCapability
} from "./prompts";

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

export type AssistOutcome =
  | {
      ok: true;
      text: string;
      capability: AssistCapability;
      promptVersion: string;
      /** Which practice-standards sections were retrieved into the prompt. */
      retrievedSources: string[];
    }
  | {
      ok: false;
      code: "phi-blocked" | "verifier-rejected" | "model-error";
      /** Cold logic for the user: what stopped the call and what to do. */
      message: string;
      rejections?: VerifyRejection[];
    };

const MAX_INPUT = 20000;

export async function runAssist(
  capability: AssistCapability,
  text: string,
  generate: GenerateFn
): Promise<AssistOutcome> {
  const input = text.slice(0, MAX_INPUT);

  // PHI gate.
  //
  // EVERY PHI finding blocks this call, not only the S0 stops — and the
  // difference between those two thresholds is the entire point.
  //
  // S2 REVIEW is the right severity for a name heuristic inside the tool,
  // because "Grace Miller" is a patient and "Bradley County" is where the health
  // department is, and blocking the line on that guess costs more than it gains.
  // That reasoning depends completely on a human being about to look at it. On
  // this path there is no human: the text is handed to a third-party provider the
  // instant the call is made, and no later review can recall it.
  //
  // So the bar for LEAVING THE BUILDING is lower than the bar for stopping the
  // line inside it. Filtering to S0 here meant "John Smith presented for recall"
  // — flagged S2 by the bare-name rule, exactly as designed — was sent to the
  // provider anyway, which is not a heuristic falling short. It is the sentence
  // on the front of the README ("No patient identifier ever enters this tool or
  // any AI platform") not being true.
  const phi = runPhiRule(input);
  if (phi.length > 0) {
    const stops = phi.filter((f) => f.severity === "S0").length;
    return {
      ok: false,
      code: "phi-blocked",
      message:
        `The AI was not called. ${phi.length} possible identifier${phi.length === 1 ? "" : "s"} ` +
        `must be removed or masked first — de-identified text is the condition for any AI ` +
        `assistance, with no exception and no override. ` +
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

  let raw: string;
  try {
    raw = await generate({ system, prompt: input });
  } catch {
    return {
      ok: false,
      code: "model-error",
      message: "The AI service did not answer. The deterministic tools still work — continue without it."
    };
  }

  const output = raw.trim();
  const mode = capability === "interrogate" || capability === "conflicts" ? "questions" : "rewrite";
  const verdict = verifyMeaning(input, output, { mode });
  if (!verdict.ok) {
    return {
      ok: false,
      code: "verifier-rejected",
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
    retrievedSources: retrieved.sources
  };
}
