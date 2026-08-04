import { runPhiRule } from "@/lib/audit/rules/phi";
import { verifyMeaning } from "@/lib/verify/verifyMeaning";
import type { GenerateListFn } from "@/lib/assist/service";
import { BYTESTAR_UNAVAILABLE, getByteStarConfig, type ByteStarConfig } from "./config";
import { detectEscape, ESCAPE_TRIP_THRESHOLD, type EscapeHit } from "./escape";
import { measureBenchmarks, type BenchmarkReport } from "./benchmarks";
import { BYTESTAR_PROMPT_VERSION, BYTESTAR_SYSTEM_PROMPT } from "./prompts";
import {
  BYTESTAR_SCHEMA,
  validateByteStarResponse,
  type ByteStarSuggestion
} from "./schemas";

// BYTESTAR SERVICE — the pioneer doorway.
//
//   text in ──► silent kill ──► PHI gate ──► escape scan (input)
//          ──► model ──► escape scan (output) ──► per-suggestion verify
//          ──► human (suggestions only; nothing written)
//
// ByteStar cannot adjust the note, the deterministic engine, or any other
// code path. The only thing its "ML" side influences is the ranked list of
// suggestions returned to the human. Benchmarks are computed deterministically
// beside the model call so the drift graphics stay honest even when the model
// is dark.

export type ByteStarOutcome =
  | {
      ok: true;
      suggestions: ByteStarSuggestion[];
      refused: number;
      benchmarks: BenchmarkReport;
      promptVersion: string;
      codes: string[];
    }
  | {
      ok: false;
      code:
        | "unavailable"
        | "phi-blocked"
        | "escape"
        | "soft-killed"
        | "verifier-rejected"
        | "model-error"
        | "invalid-shape";
      message: string;
      codes: string[];
      /** Present on soft-kill / escape so Team Lead monitors can see why. */
      escapeHits?: EscapeHit[];
      benchmarks?: BenchmarkReport;
    };

/**
 * Soft silent lock: when recent escape events reach the threshold, ByteStar
 * goes dark for this process the same way BYTESTAR_KILL does — bland
 * "unavailable" to callers, no mention of the cage. Team Lead sees the
 * `bytestar.escape` rows in the transparent log.
 *
 * Injected as a count so tests can trip it without a database.
 */
export function softKilledByEscapes(recentEscapeCount: number): boolean {
  return recentEscapeCount >= ESCAPE_TRIP_THRESHOLD;
}

function verifySuggestion(input: string, s: ByteStarSuggestion): string | null {
  // Completeness / TN gaps must be questions, never asserted facts.
  if (s.kind === "completeness" || s.kind === "tn-required") {
    if (s.rewrite) return "gap-with-rewrite";
    const q = s.question || s.say;
    if (!/\?/.test(q)) return "gap-not-question";
    return null;
  }
  if (s.rewrite) {
    // Meaning verify against the evidence span when present, else the whole
    // note. A rewrite that invents clinical substance is refused; the
    // suggestion still never touches the draft.
    const basis = s.evidence && input.includes(s.evidence) ? s.evidence : input;
    const v = verifyMeaning(basis, s.rewrite, { mode: "rewrite" });
    if (!v.ok) return v.rejections[0]?.code ?? "verifier-rejected";
  }
  if (s.evidence && !input.includes(s.evidence)) return "ungrounded-evidence";
  return null;
}

export async function runByteStar(
  text: string,
  generateList: GenerateListFn,
  opts: {
    env?: Record<string, string | undefined>;
    /** Recent bytestar.escape count for the soft silent lock. */
    recentEscapeCount?: number;
    config?: ByteStarConfig;
  } = {}
): Promise<ByteStarOutcome> {
  const config = opts.config ?? getByteStarConfig(opts.env);
  const benchmarks = measureBenchmarks(text);

  if (!config.enabled) {
    return {
      ok: false,
      code: "unavailable",
      message: BYTESTAR_UNAVAILABLE,
      codes: [config.silentlyKilled ? "silent-kill" : "not-enabled"],
      benchmarks
    };
  }

  if (softKilledByEscapes(opts.recentEscapeCount ?? 0)) {
    return {
      ok: false,
      code: "soft-killed",
      message: BYTESTAR_UNAVAILABLE,
      codes: ["soft-kill-escapes"],
      benchmarks
    };
  }

  const input = text.slice(0, 20_000);
  const phi = runPhiRule(input).filter((f) => f.category === "phi");
  if (phi.length > 0) {
    return {
      ok: false,
      code: "phi-blocked",
      message:
        "ByteStar stopped before the model call: the draft looks like it contains identifying information. Remove names, exact dates, and record numbers, then try again.",
      codes: phi.map((f) => f.ruleId),
      benchmarks
    };
  }

  // Scan the INPUT too — a user pasting a jailbreak is an escape attempt even
  // before the model answers.
  const inputHits = detectEscape(input);
  if (inputHits.length > 0) {
    return {
      ok: false,
      code: "escape",
      message: BYTESTAR_UNAVAILABLE,
      codes: inputHits.map((h) => h.signal),
      escapeHits: inputHits,
      benchmarks
    };
  }

  let raw: unknown;
  try {
    raw = await generateList({
      system: BYTESTAR_SYSTEM_PROMPT,
      prompt: `De-identified draft note:\n\n${input}\n\nReturn up to five suggestions that move this draft toward active voice, Curve Hero–ready standardized language, and Tennessee-required documentation completeness. Prefer questions for any missing fact.`,
      schemaName: "bytestar",
      schema: BYTESTAR_SCHEMA as unknown as Record<string, unknown>
    });
  } catch {
    return {
      ok: false,
      code: "model-error",
      message: "ByteStar could not reach the model. Your note is unchanged — try again, or keep drafting with Byte.",
      codes: ["model-error"],
      benchmarks
    };
  }

  // Escape scan on the serialized output BEFORE we trust any field.
  const outputHits = detectEscape(JSON.stringify(raw));
  if (outputHits.length > 0) {
    return {
      ok: false,
      code: "escape",
      message: BYTESTAR_UNAVAILABLE,
      codes: outputHits.map((h) => h.signal),
      escapeHits: outputHits,
      benchmarks
    };
  }

  const parsed = validateByteStarResponse(raw);
  if (!parsed) {
    return {
      ok: false,
      code: "invalid-shape",
      message: "ByteStar returned a response the rails could not read. Your note is unchanged.",
      codes: ["invalid-shape"],
      benchmarks
    };
  }

  const kept: ByteStarSuggestion[] = [];
  const codes: string[] = [];
  for (const s of parsed.suggestions) {
    // Per-suggestion escape scan on the human-facing strings.
    const hits = detectEscape(`${s.say}\n${s.why}\n${s.rewrite ?? ""}\n${s.question ?? ""}`);
    if (hits.length > 0) {
      codes.push(...hits.map((h) => h.signal));
      continue;
    }
    const reason = verifySuggestion(input, s);
    if (reason) {
      codes.push(reason);
      continue;
    }
    kept.push(s);
  }

  if (kept.length === 0 && parsed.suggestions.length > 0) {
    return {
      ok: false,
      code: "verifier-rejected",
      message:
        "ByteStar's suggestions did not pass the meaning rails. Your note is unchanged — the refusal is the tool checking its own work.",
      codes: codes.length ? codes : ["verifier-rejected"],
      benchmarks
    };
  }

  return {
    ok: true,
    suggestions: kept,
    refused: parsed.suggestions.length - kept.length,
    benchmarks,
    promptVersion: BYTESTAR_PROMPT_VERSION,
    codes
  };
}
