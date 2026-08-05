// BENCHMARKS — the NorthStar numbers SuperByte steers toward.
//
// Sources of truth, in this order:
//   1. Leading practices encoded in the deterministic advisor gauges
//      (read coverage, density, later-reader pillars, active voice).
//   2. Tennessee-required documentation cues (presence-only — SuperByte never
//      invents the missing language; it only reports the gap).
//   3. Team Lead feedback signals when supplied as aggregate targets
//      (optional override band; defaults below are the practice baseline).
//
// Every gauge reports BOTH the current value and the signed delta to target
// so the UI can draw "drifting toward" vs "drifting away" without inventing
// a confidence percentage. Confidence scores are a stated non-goal of the
// AI layer; a distance-to-target is a measurement, not a probability.

import { advise, type AdvisorGauges } from "@/lib/advisor/advisor";
import { detectPassive } from "@/lib/advisor/knowledge";

export interface BenchmarkTarget {
  id: string;
  label: string;
  /** Higher-is-better target in [0,1], or null when the metric is a band. */
  target: number;
  /** Optional floor of an acceptable band (density). */
  floor?: number;
  /** Optional ceiling of an acceptable band (density). */
  ceiling?: number;
}

/** Practice baseline. Team Lead overrides land here in a later revision. */
export const DEFAULT_TARGETS: readonly BenchmarkTarget[] = [
  { id: "read", label: "Parser read coverage", target: 0.9 },
  { id: "active-voice", label: "Active-voice share", target: 0.85 },
  { id: "pillars", label: "Later-reader pillars", target: 1 },
  { id: "tn-cues", label: "TN-required cues present", target: 0.8 },
  { id: "density", label: "Facts per 100 words", target: 0.5, floor: 8, ceiling: 60 }
] as const;

export type DriftDirection = "toward" | "on-target" | "away" | "n/a";

export interface BenchmarkReading {
  id: string;
  label: string;
  /** Current value in [0,1] for drawing, or a raw number for density. */
  value: number;
  /** Target in the same units as value. */
  target: number;
  /** Signed progress toward target: positive = closer / on the good side. */
  delta: number;
  direction: DriftDirection;
  /** One-line cold explanation. */
  note: string;
}

export interface BenchmarkReport {
  readings: BenchmarkReading[];
  gauges: AdvisorGauges;
  /** Share of readings that are on-target or toward. */
  onCourse: number;
  activeVoice: { passiveCount: number; sentenceEstimate: number; share: number };
  tnCues: { present: string[]; missing: string[] };
}

/** Tennessee / DES-12 presence cues — informational gaps only, never invented text. */
const TN_CUES: { id: string; label: string; re: RegExp }[] = [
  { id: "allergy", label: "Allergy / adverse-reaction status", re: /\b(nkda|nka|allerg(?:y|ies)|adverse reaction)\b/i },
  { id: "consent", label: "Consent / decision", re: /\bconsent(?:ed)?|refused|deferred|informed of (?:risks|benefits)\b/i },
  { id: "provider", label: "Provider attribution", re: /\b(dr\.?|dentist|hygienist|administered by|performed by|entered by)\b/i },
  { id: "follow-up", label: "Plan / follow-up", re: /\b(follow[- ]?up|recall|return|re-?eval|referral)\b/i },
  { id: "supervision", label: "Supervision (when hygiene)", re: /\b(direct supervision|general supervision|supervising dentist)\b/i }
];

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function directionFor(value: number, target: number, band?: { floor: number; ceiling: number }): DriftDirection {
  if (band) {
    if (value >= band.floor && value <= band.ceiling) return "on-target";
    // Closer to the band is "toward" only when we have a previous reading; for a
    // single snapshot, outside the band is "away".
    return "away";
  }
  const gap = Math.abs(value - target);
  if (gap <= 0.05) return "on-target";
  // For higher-is-better metrics, being above target is fine.
  if (value >= target) return "on-target";
  return value >= target - 0.2 ? "toward" : "away";
}

export function measureBenchmarks(text: string): BenchmarkReport {
  const report = advise(text);
  const gauges = report.gauges;
  const passive = detectPassive(text);
  // Rough sentence estimate: periods / question marks / newlines, minimum 1
  // when there is any text so a single passive clause reads as 0% active.
  const sentenceEstimate = Math.max(1, (text.match(/[.!?\n]+/g) || []).length);
  const activeShare = text.trim()
    ? clamp01(1 - passive.length / sentenceEstimate)
    : 0;

  const present: string[] = [];
  const missing: string[] = [];
  for (const cue of TN_CUES) {
    if (cue.re.test(text)) present.push(cue.label);
    else missing.push(cue.label);
  }
  const tnShare = TN_CUES.length === 0 ? 1 : present.length / TN_CUES.length;

  const pillarsShare = gauges.pillars.applicable
    ? [gauges.pillars.consent, gauges.pillars.outcome, gauges.pillars.instructions, gauges.pillars.followUp].filter(
        Boolean
      ).length / 4
    : 1; // not applicable → treat as on-target so empty exams are not punished

  const readings: BenchmarkReading[] = [
    {
      id: "read",
      label: "Parser read coverage",
      value: gauges.readCoverage,
      target: 0.9,
      delta: gauges.readCoverage - 0.9,
      direction: directionFor(gauges.readCoverage, 0.9),
      note:
        gauges.readCoverage >= 0.9
          ? "Most of the note is in language the tools can read."
          : "Some clauses still look like shorthand the tables have not met."
    },
    {
      id: "active-voice",
      label: "Active-voice share",
      value: activeShare,
      target: 0.85,
      delta: activeShare - 0.85,
      direction: directionFor(activeShare, 0.85),
      note:
        passive.length === 0
          ? "No unattributed passive constructions spotted."
          : `${passive.length} passive construction${passive.length === 1 ? "" : "s"} hide an actor.`
    },
    {
      id: "pillars",
      label: "Later-reader pillars",
      value: pillarsShare,
      target: 1,
      delta: pillarsShare - 1,
      direction: gauges.pillars.applicable ? directionFor(pillarsShare, 1) : "n/a",
      note: gauges.pillars.applicable
        ? "Consent, outcome, instructions, follow-up — presence only."
        : "Pillars apply once treatment is documented."
    },
    {
      id: "tn-cues",
      label: "TN-required cues present",
      value: tnShare,
      target: 0.8,
      delta: tnShare - 0.8,
      direction: directionFor(tnShare, 0.8),
      note:
        missing.length === 0
          ? "The common Tennessee documentation cues are present."
          : `Still open: ${missing.slice(0, 2).join("; ")}.`
    },
    {
      id: "density",
      label: "Facts per 100 words",
      value: gauges.density,
      target: 20,
      delta: gauges.density >= 8 && gauges.density <= 60 ? 0 : gauges.density < 8 ? gauges.density - 8 : 60 - gauges.density,
      direction: directionFor(gauges.density, 20, { floor: 8, ceiling: 60 }),
      note:
        gauges.density === 0
          ? "No clinical facts read yet."
          : gauges.density < 8
            ? "Sparse — a reviewer may ask what was actually done."
            : gauges.density > 60
              ? "Very dense — check that every fact earns its place."
              : "Inside the practice's useful density band."
    }
  ];

  const scored = readings.filter((r) => r.direction !== "n/a");
  const onCourse =
    scored.length === 0
      ? 1
      : scored.filter((r) => r.direction === "on-target" || r.direction === "toward").length / scored.length;

  return {
    readings,
    gauges,
    onCourse,
    activeVoice: { passiveCount: passive.length, sentenceEstimate, share: activeShare },
    tnCues: { present, missing }
  };
}
