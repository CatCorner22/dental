// THE ADVISOR ENGINE — Byte's read of a note in progress.
//
// Deterministic, client-side, and fast enough to run on every pause in typing:
// one extraction pass (measured ~1 ms) plus table lookups. No network, no
// model, no storage — the note never leaves the keyboard it is being typed on.
//
// The engine returns three things and the UI may not add a fourth:
//   ADVICE  — the highest-priority knowledge entries whose predicates match.
//   GAUGES  — live numbers a drafting screen can draw: how much of the note
//             the tools can read, how dense it is, how much anesthetic
//             headroom remains, and which defensibility pillars are present.
//   MOOD    — which face Byte makes. Derived from the same numbers, because a
//             mascot whose expression disagrees with the dashboard is a
//             mascot nobody trusts.

import { extractFacts } from "@/lib/extract/extract";
import { coverage as parseCoverage } from "@/lib/extract/extract";
import type { ClinicalFact } from "@/lib/extract/facts";
import { ANAESTHETIC_LIMITS, milligramsFrom } from "@/lib/audit/rules/anesthetic-dose";
import { KNOWLEDGE, type AdvisorContext, type KnowledgeEntry } from "./knowledge";

export interface Advice {
  id: string;
  say: string;
  why: string;
  source: string;
}

/**
 * The defensibility pillars, from the owner's litigation research: the four
 * things a reviewer asks of a treatment note when nobody disputes the
 * dentistry itself. Presence-only — Byte reports which pillars the note
 * already has, never a score, because a percentage invites gaming and a
 * checklist invites completion.
 */
export interface DefensibilityPillars {
  consent: boolean;
  outcome: boolean;
  instructions: boolean;
  followUp: boolean;
  /** Pillars only apply once the note documents treatment. */
  applicable: boolean;
}

export interface DoseGauge {
  drug: string;
  /** Milligrams documented so far. */
  mg: number;
  /** The absolute published ceiling (weight-based needs a documented weight). */
  maxMg: number;
  /** mg / maxMg, capped at 1 for drawing. */
  fraction: number;
}

export interface AdvisorGauges {
  /** Share of clauses the deterministic parser could read, 0..1. */
  readCoverage: number;
  /** Clinical facts per 100 words — the density/bloat measure. */
  density: number;
  words: number;
  facts: number;
  pillars: DefensibilityPillars;
  /** Present only when a computable anesthetic dose is on the note. */
  dose?: DoseGauge;
}

export type ByteMood = "idle" | "happy" | "thinking" | "concerned";

export interface AdvisorReport {
  advice: Advice[];
  gauges: AdvisorGauges;
  mood: ByteMood;
}

const MAX_ADVICE = 3;

function pillarsOf(facts: ClinicalFact[], lower: string): DefensibilityPillars {
  const treated = facts.some(
    (f) =>
      f.kind === "procedure" &&
      f.assertion.polarity === "affirmed" &&
      !f.assertion.temporalityHint &&
      f.category !== "diagnostic"
  );
  const care = (needle: string) =>
    facts.some((f) => f.kind === "care-event" && f.event.includes(needle));
  return {
    applicable: treated,
    consent: care("consent") || lower.includes("consent"),
    outcome:
      lower.includes("complication") ||
      facts.some((f) => f.kind === "care-event" && f.event.includes("tolerated")),
    instructions:
      care("instruction") || care("post-operative") || lower.includes("post-op"),
    followUp: care("return-to-clinic") || care("recall") || care("referral") || lower.includes("follow-up")
  };
}

function doseGauge(facts: ClinicalFact[]): DoseGauge | undefined {
  // The most-loaded anesthetic on the note, against its absolute ceiling. The
  // weight-based ceiling needs a documented weight and belongs to the audit
  // rule; the gauge is a live picture, so it uses the limit that always
  // applies and lets the audit own the stricter arithmetic.
  let best: DoseGauge | undefined;
  for (const limit of ANAESTHETIC_LIMITS) {
    let mg = 0;
    for (const f of facts) {
      if (f.kind !== "medication" || f.drug !== limit.drug) continue;
      if (f.assertion.polarity !== "affirmed" || f.assertion.temporalityHint) continue;
      if (f.volumeMl === undefined || f.concentrationPercent === undefined) continue;
      mg += milligramsFrom(f.volumeMl, f.concentrationPercent);
    }
    if (mg <= 0) continue;
    const gauge: DoseGauge = {
      drug: limit.drug,
      mg: Math.round(mg * 10) / 10,
      maxMg: limit.absoluteMaxMg,
      fraction: Math.min(1, mg / limit.absoluteMaxMg)
    };
    if (!best || gauge.fraction > best.fraction) best = gauge;
  }
  return best;
}

/**
 * Read a draft and advise. Pure and total: any string in, a report out,
 * nothing thrown, nothing stored, nothing written anywhere.
 */
export function advise(text: string): AdvisorReport {
  const trimmed = text.trim();
  const extraction = extractFacts(trimmed);
  const facts = extraction.facts;
  const lower = trimmed.toLowerCase();
  const words = trimmed ? trimmed.split(/\s+/).filter((w) => /[\p{L}\p{Nd}]/u.test(w)).length : 0;

  const ctx: AdvisorContext = {
    text: trimmed,
    lower,
    facts,
    kinds: new Set(facts.map((f) => f.kind))
  };

  const matched: KnowledgeEntry[] = [];
  for (const entry of KNOWLEDGE) {
    let hit = false;
    try {
      hit = entry.when(ctx);
    } catch {
      // A knowledge predicate must never take Byte down. A throwing entry is a
      // bug in the table, and the note-writer is not the person who can fix
      // it — so it is skipped here and caught by the integrity tests instead.
      hit = false;
    }
    if (hit) matched.push(entry);
  }
  matched.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));

  const advice: Advice[] = matched.slice(0, MAX_ADVICE).map((e) => ({
    id: e.id,
    say: e.say,
    why: e.why,
    source: e.source
  }));

  const gauges: AdvisorGauges = {
    readCoverage: parseCoverage(extraction),
    density: words === 0 ? 0 : Math.round(((facts.length / words) * 100) * 10) / 10,
    words,
    facts: facts.length,
    pillars: pillarsOf(facts, lower),
    ...(doseGauge(facts) ? { dose: doseGauge(facts) } : {})
  };

  // The mood follows the numbers, not vibes: concerned only when a
  // high-priority safety or law entry matched; happy when the note is
  // substantive and clean; thinking while there is text but little structure
  // yet; idle on an empty page.
  const mood: ByteMood =
    trimmed === ""
      ? "idle"
      : matched.some((e) => e.priority >= 70)
        ? "concerned"
        : facts.length >= 4 && advice.every((a) => a.id === "byte.first-fact" || a.id === "byte.strong-note")
          ? "happy"
          : "thinking";

  return { advice, gauges, mood };
}
