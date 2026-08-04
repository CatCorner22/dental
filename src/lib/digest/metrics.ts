// PER-NOTE QUALITY METRICS — measured, not judged.
//
// Everything here is computed from a FILED submission the practice already
// stores: the frozen note markdown and the frozen audit report. No new logging,
// for the reason unknownAbbreviations.ts states and which applies with more
// force to a report that gets sent to a supervisor — counting something you
// already hold is not a new privacy surface; recording keystrokes to grade
// people would be.
//
// ===========================================================================
// THE METRIC THIS FILE EXISTS FOR: INFORMATION DENSITY.
//
// "Verbose" and "low-effort" are the two things a Team Lead most wants flagged
// and the two hardest to define without insulting someone. Word count alone
// cannot do it: a long note may be a complicated extraction and a short one may
// be a perfect hygiene recall. Neither length is a defect on its own.
//
// What IS measurable, now that the extractor produces facts, is the ratio.
// Facts per hundred words says something word count cannot: a 400-word note
// carrying two clinical facts is bloat, and a 60-word note carrying nine is
// excellent. That is note bloat defined in a way you can show someone without
// arguing about style, and it points the same direction as every stakeholder's
// interest at once — a dense note is faster to write, faster for the next
// clinician to read, and more defensible to an insurer or an attorney.
//
// The literature backs the direction. By 2018 less than half of outpatient note
// text was directly typed in every specialty studied, and of notes containing
// duplicated text, 1.2% were judged on expert review to carry "misleading"
// information or major risk of patient harm, fraud or tort exposure. The burden
// of bloat lands on the READER, and this product's stated readers include the
// insurer, the attorney and the next treating dentist.
// ===========================================================================

import { extractFacts, coverage as parseCoverage } from "@/lib/extract/extract";
import { licenceFor } from "@/lib/audit/omissions";
import type { Severity } from "@/lib/audit/types";

export interface FiledNote {
  submissionId: number;
  authorId: string;
  /** Frozen "Display (username)" as filed. */
  authorName: string;
  filedAtIso: string;
  /** Frozen composed note. */
  markdown: string;
  /** Frozen audit report, as stored (a JSON string). */
  auditReportJson: string;
  /** Encounter/module signature, so like is compared with like. */
  noteType: string;
}

export interface NoteMetrics {
  submissionId: number;
  authorId: string;
  noteType: string;
  filedAtIso: string;
  words: number;
  /** Clinical facts the extractor could read out of it. */
  facts: number;
  /** Facts per hundred words. The bloat measure. */
  density: number;
  /** Share of clauses the parser could read, 0..1. */
  coverage: number;
  /** Answers that record an absence rather than a finding. */
  licencedOmissions: number;
  /** Findings that survived into the filed note, by severity. */
  findings: Record<Severity, number>;
}

const EMPTY_COUNTS: Record<Severity, number> = { S0: 0, S1: 0, S2: 0, S3: 0, S4: 0 };

/**
 * Read the frozen audit counts.
 *
 * Total tolerance for junk. A submission frozen by an older ruleset may carry a
 * shape this build has never seen, and a digest is never worth throwing on a
 * historical record — an unreadable report contributes zeroes and the note still
 * counts toward the denominator, which is the honest direction to fail in.
 */
export function parseFindingCounts(auditReportJson: string): Record<Severity, number> {
  try {
    const parsed = JSON.parse(auditReportJson) as { counts?: Partial<Record<Severity, number>> };
    if (!parsed || typeof parsed !== "object" || !parsed.counts) return { ...EMPTY_COUNTS };
    const out = { ...EMPTY_COUNTS };
    for (const key of Object.keys(out) as Severity[]) {
      const value = parsed.counts[key];
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) out[key] = Math.floor(value);
    }
    return out;
  } catch {
    return { ...EMPTY_COUNTS };
  }
}

/** Words, counted the way a person would count them. */
export function wordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter((w) => /[\p{L}\p{Nd}]/u.test(w)).length;
}

/**
 * The longest an answer can be and still be only a recorded absence.
 *
 * "not applicable", "none reported", "no known drug allergies (NKDA)" — the
 * real licence phrases top out around five words.
 */
const MAX_LICENCE_WORDS = 6;

/**
 * How many answers in this note record an absence rather than a finding.
 *
 * Counted per LINE, because the composed note puts one answer per line.
 *
 * THE LENGTH CAP IS LOAD-BEARING and is why this does not just call
 * `licenceFor`. That function substring-matches, which is correct where
 * `omissionReport` uses it — on discrete field values, where the value either
 * is the licence or is not. Here the input is a COMPOSED note, so a line can be
 * a full clinical sentence, and "the posterior guard is not applicable to this
 * restoration plan" is a real finding that happens to contain a licence phrase.
 * Counting it would inflate an author's omission rate on the strength of their
 * prose style, in a report that goes to their supervisor.
 */
export function countLicencedOmissions(markdown: string): number {
  let count = 0;
  for (const rawLine of markdown.split("\n")) {
    // Strip a leading "Label:" so the value is what gets tested.
    const value = rawLine.replace(/^[^:\n]{1,60}:\s*/, "").trim();
    if (!value) continue;
    if (wordCount(value) > MAX_LICENCE_WORDS) continue;
    if (licenceFor(value)) count++;
  }
  return count;
}

export function noteMetrics(note: FiledNote): NoteMetrics {
  const words = wordCount(note.markdown);
  const extraction = extractFacts(note.markdown);
  const facts = extraction.facts.length;
  return {
    submissionId: note.submissionId,
    authorId: note.authorId,
    noteType: note.noteType,
    filedAtIso: note.filedAtIso,
    words,
    facts,
    // Guarded rather than clamped: a zero-word note has no density, and
    // reporting 0 would put it in the same bucket as a 500-word note with no
    // facts, which is a different problem needing a different sentence.
    density: words === 0 ? 0 : (facts / words) * 100,
    coverage: parseCoverage(extraction),
    licencedOmissions: countLicencedOmissions(note.markdown),
    findings: parseFindingCounts(note.auditReportJson)
  };
}

/** Median rather than mean, throughout. One 4,000-word note must not move the bar. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
