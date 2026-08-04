// THE TEAM LEAD DIGEST — patterns, batched, never a verdict on one note.
//
// ===========================================================================
// FOUR RULES, AND THEY OUTRANK EVERY METRIC IN THIS DIRECTORY
//
// 1. A DIGEST, NOT AN ALERT. Nothing here fires at the moment someone files a
//    note. The alert-fatigue evidence is unambiguous — drug-allergy alerts were
//    overridden 87.6% of the time across 611,192 of them, and REPEATED alerts
//    were overridden 12 points harder than first-time ones. A per-note nag to a
//    supervisor would be ignored inside a fortnight and would poison every
//    other signal this tool sends. Batching is not a convenience; it is what
//    keeps the signal alive.
//
// 2. NEVER A SINGLE NOTE. Every signal needs a minimum sample. One bad note is
//    a bad day, and a tool that reports bad days to a supervisor is a
//    surveillance tool. Staff will notice within a week, and a documentation
//    tool the staff resent is worse than no tool — they will write the
//    shortest thing that clears the gates, which is the exact outcome this
//    product exists to prevent.
//
// 3. LIKE COMPARED WITH LIKE. An oral surgeon's notes and a hygienist's recall
//    notes have nothing to say about each other. Comparison happens inside a
//    note type or it does not happen.
//
// 4. IF IT APPLIES TO EVERYONE, IT IS ABOUT THE TOOL. This is the rule that
//    protects staff from bad tooling, and it is enforced in code below, not
//    left to a reader's good judgement. When most of the practice would be
//    flagged for the same thing, the finding is re-scoped to the practice and
//    the names are dropped — because a standard nobody meets is a badly set
//    standard, and reporting it as eleven individual failings would be both
//    false and corrosive.
// ===========================================================================
//
// TONE. State WHAT was found and HOW to move. No adjectives about people, no
// rankings, no "worst offender". Every headline here should be readable aloud
// in a team meeting without anyone feeling ambushed.

import { median, noteMetrics, type FiledNote, type NoteMetrics } from "./metrics";
import { duplicatePairs, fingerprint, type DuplicatePair } from "./similarity";

export interface DigestSignal {
  id: string;
  scope: "practice" | "person";
  authorId?: string;
  authorName?: string;
  /** What was found. A fact, in one sentence. */
  headline: string;
  /** Why it is worth a look, and what moves it. */
  detail: string;
  /** Notes this is based on. Shown so a reader can weigh it. */
  sample: number;
}

export interface Digest {
  periodFrom: string;
  periodTo: string;
  notesReviewed: number;
  authorsReviewed: number;
  signals: DigestSignal[];
  /** Stated even when empty, because "nothing to report" is a real result. */
  allClear: boolean;
}

export const DIGEST_RULES = {
  /** Below this, an author is not compared to anyone. */
  MIN_NOTES_PER_AUTHOR: 10,
  /** Below this many eligible authors, there is no practice median worth having. */
  MIN_AUTHORS_FOR_COMPARISON: 3,
  /**
   * How far from the practice median before it is worth mentioning.
   *
   * Half the median, or double it, depending on direction. A wide band on
   * purpose: normal variation between two competent clinicians is large, and
   * every borderline signal spends credibility the sharp ones need.
   */
  DENSITY_FLOOR_RATIO: 0.5,
  OMISSION_CEILING_RATIO: 2,
  /** Rule 4: at or above this share of authors, the finding is about the tool. */
  SYSTEMIC_SHARE: 0.6,
  /** Practice-level parser coverage below this means the tool cannot read this work. */
  COVERAGE_FLOOR: 0.5
} as const;

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function round1(value: number): string {
  return value.toFixed(1);
}

interface AuthorGroup {
  authorId: string;
  authorName: string;
  metrics: NoteMetrics[];
}

/**
 * Build the digest.
 *
 * Pure: takes filed notes, returns sentences. No database access, no clock, no
 * side effects — which is what lets the fairness rules above be tested rather
 * than asserted.
 */
export function buildDigest(
  notes: FiledNote[],
  periodFrom: string,
  periodTo: string
): Digest {
  const metrics = notes.map(noteMetrics);
  const nameOf = new Map(notes.map((n) => [n.authorId, n.authorName]));

  const byAuthor = new Map<string, AuthorGroup>();
  for (const m of metrics) {
    const group = byAuthor.get(m.authorId) ?? {
      authorId: m.authorId,
      authorName: nameOf.get(m.authorId) ?? m.authorId,
      metrics: []
    };
    group.metrics.push(m);
    byAuthor.set(m.authorId, group);
  }

  const signals: DigestSignal[] = [];

  // --- Practice-level: can the tool even read this work? ---------------------
  // Reported FIRST because it is a statement about the product, and a Team Lead
  // reading a list of staff observations should see the tool's own limitations
  // before anyone else's.
  const byType = new Map<string, NoteMetrics[]>();
  for (const m of metrics) byType.set(m.noteType, [...(byType.get(m.noteType) ?? []), m]);

  for (const [noteType, group] of byType) {
    if (group.length < DIGEST_RULES.MIN_NOTES_PER_AUTHOR) continue;
    const cov = median(group.map((m) => m.coverage));
    if (cov >= DIGEST_RULES.COVERAGE_FLOOR) continue;
    signals.push({
      id: `practice.coverage.${noteType}`,
      scope: "practice",
      headline: `Smile Notes could read ${pct(cov)} of a typical ${noteType} note this period.`,
      detail:
        "That is a gap in the tool, not in the writing. The phrases it could not read are listed on each note, and adding them to the vocabulary is a change request rather than something staff should work around.",
      sample: group.length
    });
  }

  // --- Per-author comparisons, gated by rules 2, 3 and 4 ---------------------
  const eligible = [...byAuthor.values()].filter(
    (g) => g.metrics.length >= DIGEST_RULES.MIN_NOTES_PER_AUTHOR
  );

  if (eligible.length >= DIGEST_RULES.MIN_AUTHORS_FOR_COMPARISON) {
    const practiceDensity = median(metrics.map((m) => m.density));
    const practiceOmission = median(metrics.map((m) => m.licencedOmissions));

    const lowDensity = eligible.filter(
      (g) =>
        practiceDensity > 0 &&
        median(g.metrics.map((m) => m.density)) < practiceDensity * DIGEST_RULES.DENSITY_FLOOR_RATIO
    );
    const highOmission = eligible.filter(
      (g) =>
        practiceOmission > 0 &&
        median(g.metrics.map((m) => m.licencedOmissions)) >
          practiceOmission * DIGEST_RULES.OMISSION_CEILING_RATIO
    );

    pushComparative(signals, {
      flagged: lowDensity,
      total: eligible.length,
      idBase: "density",
      systemicHeadline: `Across the practice, notes are running long relative to what they record (practice median ${round1(
        practiceDensity
      )} facts per 100 words).`,
      systemicDetail:
        "When most of a team lands in the same place, the template is usually asking for prose where it could ask for a value. Worth reviewing the fields themselves before anyone's writing.",
      personHeadline: (g) =>
        `${g.authorName}: ${round1(
          median(g.metrics.map((m) => m.density))
        )} clinical facts per 100 words, against a practice median of ${round1(practiceDensity)}.`,
      personDetail:
        "Longer notes that record less take more time to write and more time for the next clinician, insurer or attorney to read. Usually the fix is naming teeth, surfaces and materials explicitly rather than describing the visit in prose."
    });

    pushComparative(signals, {
      flagged: highOmission,
      total: eligible.length,
      idBase: "omissions",
      systemicHeadline:
        "Across the practice, a high share of required answers record an absence rather than a finding.",
      systemicDetail:
        "A recorded absence is defensible and is a legitimate answer. When most of a team reaches for it on the same fields, the fields are usually asking for something the visit does not produce — that is a template change, not a coaching conversation.",
      personHeadline: (g) =>
        `${g.authorName}: a median of ${median(
          g.metrics.map((m) => m.licencedOmissions)
        )} answers per note record an absence, against a practice median of ${practiceOmission}.`,
      personDetail:
        "Both a recorded absence and a fact are defensible; only one is useful to whoever reads the note next. Worth checking whether any of these could be answered instead."
    });
  }

  // --- Copy-forward ----------------------------------------------------------
  const prints = notes.map((n) =>
    fingerprint({
      submissionId: n.submissionId,
      authorId: n.authorId,
      noteType: n.noteType,
      markdown: n.markdown
    })
  );
  const dupes = duplicatePairs(prints);
  const dupesByAuthor = new Map<string, DuplicatePair[]>();
  for (const d of dupes) dupesByAuthor.set(d.authorId, [...(dupesByAuthor.get(d.authorId) ?? []), d]);

  for (const [authorId, pairs] of dupesByAuthor) {
    const group = byAuthor.get(authorId);
    if (!group || group.metrics.length < DIGEST_RULES.MIN_NOTES_PER_AUTHOR) continue;
    const noFacts = pairs.filter((p) => p.kind === "no-facts").length;
    signals.push({
      id: `duplicates.${authorId}`,
      scope: "person",
      authorId,
      authorName: group.authorName,
      headline: `${group.authorName}: ${pairs.length} pair${
        pairs.length === 1 ? "" : "s"
      } of notes this period are near-identical and name the same teeth${
        noFacts > 0 ? `, ${noFacts} of them recording no clinical facts at all` : ""
      }.`,
      detail:
        "Standardised wording is the point of this tool and similar notes are expected. These are flagged because the parts that should differ between two patients did not. Worth confirming each was written for the visit it is filed against.",
      sample: group.metrics.length
    });
  }

  // --- Notes filed with required items still open ----------------------------
  const filedWithOpen = metrics.filter((m) => m.findings.S1 > 0);
  if (filedWithOpen.length > 0 && metrics.length >= DIGEST_RULES.MIN_NOTES_PER_AUTHOR) {
    signals.push({
      id: "practice.filed-with-open-required",
      scope: "practice",
      headline: `${filedWithOpen.length} of ${metrics.length} notes were filed with at least one required item still open.`,
      detail:
        "Filing is allowed in this state by design, so this is a count rather than a breach. A rate that climbs usually means a required field is asking for something the visit does not produce.",
      sample: metrics.length
    });
  }

  return {
    periodFrom,
    periodTo,
    notesReviewed: notes.length,
    authorsReviewed: byAuthor.size,
    signals,
    allClear: signals.length === 0
  };
}

/**
 * Emit a comparative finding as either per-person signals or one practice-level
 * signal, per rule 4.
 */
function pushComparative(
  out: DigestSignal[],
  input: {
    flagged: AuthorGroup[];
    total: number;
    idBase: string;
    systemicHeadline: string;
    systemicDetail: string;
    personHeadline: (g: AuthorGroup) => string;
    personDetail: string;
  }
): void {
  if (input.flagged.length === 0) return;

  if (input.flagged.length / input.total >= DIGEST_RULES.SYSTEMIC_SHARE) {
    out.push({
      id: `practice.${input.idBase}`,
      scope: "practice",
      headline: input.systemicHeadline,
      detail: input.systemicDetail,
      sample: input.total
    });
    return;
  }

  for (const g of input.flagged) {
    out.push({
      id: `${input.idBase}.${g.authorId}`,
      scope: "person",
      authorId: g.authorId,
      authorName: g.authorName,
      headline: input.personHeadline(g),
      detail: input.personDetail,
      sample: g.metrics.length
    });
  }
}
