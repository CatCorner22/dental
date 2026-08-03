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

  // PHI gate. ANY phi finding blocks the call — not only S0. Bare-name hits
  // are S2 for the in-app audit (review, not hard-stop on filing), but an AI
  // provider is off-server: probable patient names must never leave either.
  const phi = runPhiRule(input).filter((f) => f.category === "phi");
  if (phi.length > 0) {
    return {
      ok: false,
      code: "phi-blocked",
      message:
        `The AI was not called. ${phi.length} possible identifier${phi.length === 1 ? "" : "s"} ` +
        `must be removed or masked first — de-identified text is the condition for any AI ` +
        `assistance, with no exception and no override.`
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
