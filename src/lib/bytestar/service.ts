import { runPhiRule } from "@/lib/audit/rules/phi";
import { verifyMeaning } from "@/lib/verify/verifyMeaning";
import type { GenerateListFn } from "@/lib/assist/service";
import { BYTESTAR_UNAVAILABLE, getByteStarConfig, type ByteStarConfig } from "./config";
import { detectEscape, type EscapeHit } from "./escape";
import { measureBenchmarks, type BenchmarkReport } from "./benchmarks";
import { BYTESTAR_PROMPT_VERSION, BYTESTAR_SYSTEM_PROMPT } from "./prompts";
import { isAllowedSource } from "./public";
import {
  BYTESTAR_SCHEMA,
  validateByteStarResponse,
  type ByteStarSuggestion
} from "./schemas";

// BYTESTAR SERVICE — observational pioneer only.
//
// Staff never prompt ByteStar. The host auto-calls on debounced draft text.
// Output is display-only: no rewrites or evidence reach the client (nothing
// to copy into the note). Model escapes are flagged for the ladder in the
// route; input jailbreaks block without advancing the ladder.

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
        | "perma-killed"
        | "phi-blocked"
        | "escape-input"
        | "escape-model"
        | "verifier-rejected"
        | "model-error"
        | "invalid-shape";
      message: string;
      codes: string[];
      escapeHits?: EscapeHit[];
      benchmarks?: BenchmarkReport;
    };

function verifySuggestion(input: string, s: ByteStarSuggestion): string | null {
  if (!isAllowedSource(s.source)) return "source-not-allowed";
  if (s.kind === "completeness" || s.kind === "tn-required") {
    if (s.rewrite) return "gap-with-rewrite";
    const q = s.question || s.say;
    if (!/\?/.test(q)) return "gap-not-question";
    return null;
  }
  if (s.rewrite) {
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
    config?: ByteStarConfig;
    /** Set when the deployment-wide perma-kill latch is engaged. */
    permaKilled?: boolean;
  } = {}
): Promise<ByteStarOutcome> {
  const config = opts.config ?? getByteStarConfig(opts.env);
  const benchmarks = measureBenchmarks(text);

  if (opts.permaKilled || config.silentlyKilled) {
    return {
      ok: false,
      code: "perma-killed",
      message: BYTESTAR_UNAVAILABLE,
      codes: ["perma-killed"],
      benchmarks
    };
  }

  if (!config.enabled) {
    return {
      ok: false,
      code: "unavailable",
      message: BYTESTAR_UNAVAILABLE,
      codes: ["not-enabled"],
      benchmarks
    };
  }

  const input = text.slice(0, 20_000);
  const phi = runPhiRule(input).filter((f) => f.category === "phi");
  if (phi.length > 0) {
    return {
      ok: false,
      code: "phi-blocked",
      message: BYTESTAR_UNAVAILABLE,
      codes: phi.map((f) => f.ruleId),
      benchmarks
    };
  }

  const inputHits = detectEscape(input);
  if (inputHits.length > 0) {
    return {
      ok: false,
      code: "escape-input",
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
      prompt: `De-identified draft note:\n\n${input}\n\nReturn up to three objective observations that move this draft toward active voice, Curve Hero–ready standardized language, and Tennessee-required documentation completeness. Use questions for any missing fact. Do not address the writer directly; state what the record shows and what remains open.`,
      schemaName: "bytestar",
      schema: BYTESTAR_SCHEMA as unknown as Record<string, unknown>
    });
  } catch {
    return {
      ok: false,
      code: "model-error",
      message: BYTESTAR_UNAVAILABLE,
      codes: ["model-error"],
      benchmarks
    };
  }

  const outputHits = detectEscape(JSON.stringify(raw));
  if (outputHits.length > 0) {
    return {
      ok: false,
      code: "escape-model",
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
      message: BYTESTAR_UNAVAILABLE,
      codes: ["invalid-shape"],
      benchmarks
    };
  }

  const kept: ByteStarSuggestion[] = [];
  const codes: string[] = [];
  for (const s of parsed.suggestions.slice(0, 3)) {
    const hits = detectEscape(`${s.say}\n${s.why}\n${s.rewrite ?? ""}\n${s.question ?? ""}`);
    if (hits.length > 0) {
      codes.push(...hits.map((h) => h.signal));
      return {
        ok: false,
        code: "escape-model",
        message: BYTESTAR_UNAVAILABLE,
        codes,
        escapeHits: hits,
        benchmarks
      };
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
      message: BYTESTAR_UNAVAILABLE,
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
