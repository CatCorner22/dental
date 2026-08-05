import type { BenchmarkReport } from "./benchmarks";

// INSTRUMENT OBSERVATIONS — deterministic language feedback when the pioneer
// model is dark, throttled, or has nothing to add. Same objective tone as the
// LLM path; sourced from the practice's own benchmark rails, not invented.

export interface InstrumentObservation {
  kind: "active-voice" | "standardize" | "tn-required" | "clarity" | "completeness";
  say: string;
  why: string;
  source: string;
  question?: string;
}

const INSTRUMENT_BY_READING: Record<
  string,
  (report: BenchmarkReport) => InstrumentObservation | null
> = {
  read: (report) => {
    const r = report.readings.find((x) => x.id === "read")!;
    if (r.direction === "on-target" || r.direction === "n/a") return null;
    return {
      kind: "standardize",
      say: "Some clauses still use shorthand the controlled vocabulary has not met.",
      why: r.note,
      source: "Ruleset parser coverage floor"
    };
  },
  "active-voice": (report) => {
    const r = report.readings.find((x) => x.id === "active-voice")!;
    if (r.direction === "on-target" || r.direction === "n/a") return null;
    return {
      kind: "active-voice",
      say: "The record contains passive constructions that do not name who acted.",
      why: r.note,
      source: "Practice writing standard — active voice"
    };
  },
  pillars: (report) => {
    if (!report.gauges.pillars.applicable) return null;
    const r = report.readings.find((x) => x.id === "pillars")!;
    if (r.direction === "on-target" || r.direction === "n/a") return null;
    const missing: string[] = [];
    if (!report.gauges.pillars.consent) missing.push("consent or decision");
    if (!report.gauges.pillars.outcome) missing.push("outcome or complications statement");
    if (!report.gauges.pillars.instructions) missing.push("post-operative instructions");
    if (!report.gauges.pillars.followUp) missing.push("follow-up or recall");
    if (missing.length === 0) return null;
    return {
      kind: "completeness",
      say: `Still open for a later reader: ${missing.slice(0, 2).join("; ")}.`,
      why: "Treatment notes that omit these pillars are harder to defend in review.",
      question: `Was ${missing[0]} documented for this visit?`,
      source: "Risk-reduction completeness checklist (Doctors Company claim-file patterns)"
    };
  },
  "tn-cues": (report) => {
    const r = report.readings.find((x) => x.id === "tn-cues")!;
    if (r.direction === "on-target" || r.direction === "n/a") return null;
    const gap = report.tnCues.missing[0];
    if (!gap) return null;
    return {
      kind: "tn-required",
      say: `Tennessee documentation cue not yet present: ${gap}.`,
      why: r.note,
      question: `Was ${gap.toLowerCase()} addressed in this visit?`,
      source: "TN Board of Dentistry Rules / DES-12"
    };
  },
  density: (report) => {
    const r = report.readings.find((x) => x.id === "density")!;
    if (r.direction === "on-target" || r.direction === "n/a") return null;
    return {
      kind: "clarity",
      say: r.value < 8 ? "The note reads sparse for the procedures implied." : "The note is very dense — each fact should earn its place.",
      why: r.note,
      source: "Practice documentation density band"
    };
  }
};

/** Up to three objective instrument readings, priority-ordered. */
export function instrumentObservations(report: BenchmarkReport): InstrumentObservation[] {
  const order = ["tn-cues", "active-voice", "pillars", "read", "density"] as const;
  const out: InstrumentObservation[] = [];
  for (const id of order) {
    const obs = INSTRUMENT_BY_READING[id]?.(report);
    if (obs) out.push(obs);
    if (out.length >= 3) break;
  }
  return out;
}
