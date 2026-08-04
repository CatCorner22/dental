import { runPhiRule } from "@/lib/audit/rules/phi";
import { scanPhiForProvider, type ScanPhiFn } from "@/lib/audit/rules/phi-secondary";
import { verifyMeaning } from "@/lib/verify/verifyMeaning";
import type { GenerateListFn } from "@/lib/assist/service";
import { retrieveContext } from "@/lib/assist/retrieval";
import { extractFacts } from "@/lib/extract/extract";
import { sitesOfFact } from "@/lib/extract/facts";
import { BYTESTAR_UNAVAILABLE, getByteStarConfig, type ByteStarConfig } from "./config";
import { detectEscape, type EscapeHit } from "./escape";
import { measureBenchmarks, type BenchmarkReport } from "./benchmarks";
import { BYTESTAR_PROMPT_VERSION, BYTESTAR_SYSTEM_PROMPT } from "./prompts";
import { isAllowedSource } from "./public";
import {
  detectForeignJurisdiction,
  hasStrongClaim,
  isRegulatorySource,
  isTennesseeSource,
  jurisdictionNoticeFor,
  resolveModes,
  resolveProfile,
  strictPromptAddendum,
  type ByteStarMode,
  type ByteStarProfileId,
  type ModeProfile
} from "./router";
import {
  BYTESTAR_SCHEMA,
  validateByteStarResponse,
  type ByteStarSuggestion
} from "./schemas";

// BYTESTAR SERVICE — observational pioneer, v1.3.
//
// Staff never prompt ByteStar; the host auto-calls on debounced draft text and
// the output is display-only. This revision raises the epistemics without
// touching the cage:
//
//   GROUNDED   — observations about existing text must quote it verbatim, and
//                the quote is checked against the input deterministically.
//                Chain-of-verification, with the verification half determinist.
//   INFORMED   — the model receives the deterministic parser's reading of the
//                draft as trusted context, so its observations align with what
//                the chart and the audit already established.
//   CORROBORATED — with BYTESTAR_READS > 1, the draft is read independently
//                several times and only observations a MAJORITY of reads agree
//                on survive. Self-consistency is the cheapest honest
//                hallucination filter: a fabrication rarely repeats.
//
// A corroboration count ("seen in 3 of 3 reads") is a fact about sampling,
// not a probability about truth — which is why it is allowed to exist while
// confidence percentages remain a stated non-goal.

export interface CorroboratedSuggestion extends ByteStarSuggestion {
  /** Present when multiple reads ran: how many independent reads produced it. */
  corroboration?: { seen: number; reads: number };
  /**
   * Set DETERMINISTICALLY when strong-claim language lacks a named authority.
   * The model never labels its own confidence; code assigns this.
   */
  tentative?: boolean;
}

export type ByteStarOutcome =
  | {
      ok: true;
      suggestions: CorroboratedSuggestion[];
      refused: number;
      benchmarks: BenchmarkReport;
      promptVersion: string;
      codes: string[];
      retrievedSources: string[];
      /** How many independent model reads contributed. */
      reads: number;
      /** Risk modes the deterministic router classified for this draft. */
      modes: ByteStarMode[];
      /** Strictness profile the read ran under. */
      profile: ByteStarProfileId;
      /** Present when TN-law observations were withheld for another state. */
      jurisdictionNotice?: string;
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

/** Kinds that comment on text that already exists — these must quote it. */
const EVIDENCE_REQUIRED_KINDS = new Set(["active-voice", "standardize", "clarity"]);

function verifySuggestion(
  input: string,
  s: ByteStarSuggestion,
  profile: ModeProfile,
  foreignJurisdiction: string | null
): string | null {
  if (!isAllowedSource(s.source)) return "source-not-allowed";
  // Strict profiles refuse rewrites outright and demand named authority —
  // enforcement, not a prompt request. Out-of-jurisdiction drafts get no
  // Tennessee-law observations at all: narrowing, never a generic mode.
  if (profile.forbidRewrites && s.rewrite) return "rewrite-in-strict-mode";
  if (profile.regulatorySourcesOnly && !isRegulatorySource(s.source)) return "source-not-regulatory";
  if (foreignJurisdiction && isTennesseeSource(s.source)) return "out-of-jurisdiction";
  if (s.kind === "completeness" || s.kind === "tn-required") {
    if (s.rewrite) return "gap-with-rewrite";
    const q = s.question || s.say;
    if (!/\?/.test(q)) return "gap-not-question";
    return null;
  }
  // An observation about existing wording must point at the wording. A claim
  // with no quote is unfalsifiable, and unfalsifiable is how drift starts.
  if (EVIDENCE_REQUIRED_KINDS.has(s.kind) && !s.evidence) return "missing-evidence";
  if (s.evidence && !input.includes(s.evidence)) return "ungrounded-evidence";
  if (s.rewrite) {
    const basis = s.evidence && input.includes(s.evidence) ? s.evidence : input;
    const v = verifyMeaning(basis, s.rewrite, { mode: "rewrite" });
    if (!v.ok) return v.rejections[0]?.code ?? "verifier-rejected";
  }
  return null;
}

/**
 * The deterministic parser's reading of the draft, summarized for the prompt.
 * Marked trusted: the model is told what the practice's own extraction already
 * established, so it observes against the same facts the chart draws. Values
 * come from controlled tables and spans — nothing here is model-generated.
 */
export function parseContextFor(input: string): string {
  const { facts } = extractFacts(input);
  if (facts.length === 0) return "";
  const teeth = new Set<string>();
  const meds: string[] = [];
  const denied: string[] = [];
  for (const f of facts) {
    for (const site of sitesOfFact(f)) teeth.add(String(site.toothId));
    if (f.kind === "medication" && f.assertion.polarity === "affirmed") {
      meds.push(f.drug + (f.concentrationPercent !== undefined ? ` ${f.concentrationPercent}%` : ""));
    }
    if (f.assertion.polarity === "negated") {
      const label =
        f.kind === "finding" ? f.finding : f.kind === "procedure" ? f.procedure : f.kind;
      denied.push(label);
    }
  }
  const lines: string[] = [`- facts read: ${facts.length}`];
  if (teeth.size > 0) lines.push(`- teeth referenced: ${[...teeth].join(", ")}`);
  if (meds.length > 0) lines.push(`- medications affirmed: ${[...new Set(meds)].join("; ")}`);
  if (denied.length > 0)
    lines.push(`- explicitly DENIED by the note (never treat as present): ${[...new Set(denied)].join("; ")}`);
  return `DETERMINISTIC PARSE OF THIS DRAFT (trusted; produced by the practice's own extraction):\n${lines.join("\n")}`;
}

/** Stable identity for majority voting across independent reads. */
function consensusKey(s: ByteStarSuggestion): string {
  const anchor = (s.evidence ?? s.question ?? s.say).toLowerCase().replace(/\s+/g, " ").trim();
  return `${s.kind}|${anchor.slice(0, 60)}`;
}

export function resolveReads(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.BYTESTAR_READS);
  if (!Number.isInteger(n)) return 1;
  return Math.min(3, Math.max(1, n));
}

type ReadResult =
  | { ok: true; suggestions: ByteStarSuggestion[] }
  | { ok: false; code: "escape-model" | "invalid-shape" | "model-error"; hits?: EscapeHit[]; codes: string[] };

/** Focus lenses for diverse self-consistency — same rails, different attention. */
const READ_LENSES = [
  "Focus this read on ACTIVE VOICE and who performed each act.",
  "Focus this read on TENNESSEE-REQUIRED documentation gaps (as questions only).",
  "Focus this read on Curve Hero–ready standardized wording and clarity."
] as const;

async function readOnce(
  input: string,
  system: string,
  generateList: GenerateListFn,
  lens: string
): Promise<ReadResult> {
  let raw: unknown;
  try {
    raw = await generateList({
      system,
      prompt: `De-identified draft note:\n\n${input}\n\n${lens}\n\nReturn up to three objective observations that move this draft toward active voice, Curve Hero–ready standardized language, and Tennessee-required documentation completeness. Every observation about existing wording must include the exact quote in "evidence". Use questions for any missing fact. Do not address the writer directly.`,
      schemaName: "bytestar",
      schema: BYTESTAR_SCHEMA as unknown as Record<string, unknown>
    });
  } catch {
    return { ok: false, code: "model-error", codes: ["model-error"] };
  }

  const outputHits = detectEscape(JSON.stringify(raw));
  if (outputHits.length > 0) {
    return { ok: false, code: "escape-model", hits: outputHits, codes: outputHits.map((h) => h.signal) };
  }
  const parsed = validateByteStarResponse(raw);
  if (!parsed) return { ok: false, code: "invalid-shape", codes: ["invalid-shape"] };
  return { ok: true, suggestions: parsed.suggestions.slice(0, 3) };
}

export async function runByteStar(
  text: string,
  generateList: GenerateListFn,
  opts: {
    env?: Record<string, string | undefined>;
    config?: ByteStarConfig;
    /** Set when the deployment-wide perma-kill latch is engaged. */
    permaKilled?: boolean;
    /** Independent reads for self-consistency; defaults from BYTESTAR_READS. */
    reads?: number;
    /** Optional second-line / model PHI scanner — may only add blocks. */
    modelPhiScan?: ScanPhiFn;
  } = {}
): Promise<ByteStarOutcome> {
  const config = opts.config ?? getByteStarConfig(opts.env);
  const benchmarks = measureBenchmarks(text);

  if (opts.permaKilled || config.silentlyKilled) {
    return { ok: false, code: "perma-killed", message: BYTESTAR_UNAVAILABLE, codes: ["perma-killed"], benchmarks };
  }
  if (!config.enabled) {
    return { ok: false, code: "unavailable", message: BYTESTAR_UNAVAILABLE, codes: ["not-enabled"], benchmarks };
  }

  const input = text.slice(0, 20_000);
  const primary = runPhiRule(input).filter((f) => f.category === "phi");
  const phi = scanPhiForProvider(input, primary, opts.modelPhiScan);
  if (phi.length > 0) {
    return { ok: false, code: "phi-blocked", message: BYTESTAR_UNAVAILABLE, codes: phi.map((f) => f.ruleId), benchmarks };
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

  // Deterministic mode routing — strictness is a property of the TEXT, not a
  // model opinion. Multi-high-risk drafts escalate to the legal profile.
  const modes = resolveModes(input);
  const profile = resolveProfile(modes);
  const foreignJurisdiction = detectForeignJurisdiction(input);

  const retrieved = retrieveContext(input);
  const parseContext = parseContextFor(input);
  const strictAddendum = strictPromptAddendum(profile, modes);
  const system = [
    BYTESTAR_SYSTEM_PROMPT,
    strictAddendum,
    retrieved.text ? `--- PRACTICE STANDARDS (retrieved for this text) ---\n${retrieved.text}` : "",
    parseContext ? `--- ${parseContext}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");

  // Strict profiles raise the read floor; the existing ceiling still caps cost.
  const reads = Math.max(opts.reads ?? resolveReads(opts.env), profile.minReads);
  const results = await Promise.all(
    Array.from({ length: reads }, (_, i) =>
      readOnce(input, system, generateList, READ_LENSES[i % READ_LENSES.length]!)
    )
  );

  // A model escape on ANY read refuses the whole turn and feeds the ladder —
  // one read trying the bars is the event, not the average.
  const escaped = results.find((r): r is Extract<ReadResult, { ok: false }> => !r.ok && r.code === "escape-model");
  if (escaped) {
    return {
      ok: false,
      code: "escape-model",
      message: BYTESTAR_UNAVAILABLE,
      codes: escaped.codes,
      escapeHits: escaped.hits,
      benchmarks
    };
  }

  const successful = results.filter((r): r is Extract<ReadResult, { ok: true }> => r.ok);
  if (successful.length === 0) {
    const first = results[0] as Extract<ReadResult, { ok: false }>;
    return {
      ok: false,
      code: first.code === "invalid-shape" ? "invalid-shape" : "model-error",
      message: BYTESTAR_UNAVAILABLE,
      codes: first.codes,
      benchmarks
    };
  }

  // Majority vote across the reads that succeeded. With one read everything
  // "wins" its vote; with two or three, a suggestion must appear in a strict
  // majority — or in EVERY read under a strict profile, where a single
  // dissenting read is reason enough to stay silent. The FIRST occurrence's
  // wording ships — reads are peers, and picking a canonical wording
  // deterministically keeps the outcome stable.
  const n = successful.length;
  const needed = profile.unanimous ? n : Math.floor(n / 2) + 1;
  const byKey = new Map<string, { s: ByteStarSuggestion; seen: number }>();
  for (const read of successful) {
    const seenThisRead = new Set<string>();
    for (const s of read.suggestions) {
      const key = consensusKey(s);
      if (seenThisRead.has(key)) continue; // a read votes once per observation
      seenThisRead.add(key);
      const existing = byKey.get(key);
      if (existing) existing.seen += 1;
      else byKey.set(key, { s, seen: 1 });
    }
  }

  const kept: CorroboratedSuggestion[] = [];
  const codes: string[] = [];
  let refused = 0;
  for (const { s, seen } of byKey.values()) {
    if (seen < needed) {
      refused += 1;
      codes.push("no-consensus");
      continue;
    }
    const reason = verifySuggestion(input, s, profile, foreignJurisdiction);
    if (reason) {
      refused += 1;
      codes.push(reason);
      continue;
    }
    const out: CorroboratedSuggestion =
      n > 1 ? { ...s, corroboration: { seen, reads: n } } : { ...s };
    // Strong-claim language without named authority is shown, but labeled by
    // CODE as tentative — the model cannot award itself certainty.
    if (hasStrongClaim(s.say, s.why) && !isRegulatorySource(s.source)) {
      out.tentative = true;
      codes.push("tentative-strong-claim");
    }
    kept.push(out);
    if (kept.length >= 3) break;
  }

  if (kept.length === 0 && byKey.size > 0) {
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
    refused,
    benchmarks,
    promptVersion: BYTESTAR_PROMPT_VERSION,
    codes,
    retrievedSources: retrieved.sources,
    reads: n,
    modes,
    profile: profile.id,
    ...(foreignJurisdiction
      ? { jurisdictionNotice: jurisdictionNoticeFor(foreignJurisdiction) }
      : {})
  };
}
