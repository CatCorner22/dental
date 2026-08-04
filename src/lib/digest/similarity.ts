// NEAR-DUPLICATE DETECTION — telling copy-forward apart from a template working.
//
// ===========================================================================
// THE TRAP THIS FILE IS BUILT AROUND
//
// Dental notes for the same procedure SHOULD look alike. A prophylaxis note is
// a prophylaxis note; a practice that has standardised its wording — which is
// this product's entire stated purpose — will produce notes that are 90%
// identical, and that is the tool working, not failing. A duplicate detector
// that flags similarity alone would fire on every well-run practice and would
// be switched off within a week.
//
// So similarity on its own is not the signal. THE DISCRIMINATOR IS WHETHER THE
// PARTS THAT SHOULD DIFFER, DIFFER.
//
//   near-identical text + DIFFERENT teeth   -> a template doing its job
//   near-identical text + THE SAME teeth    -> copy-forward
//   near-identical text + NO facts at all   -> boilerplate carrying nothing
//                                              patient-specific, the strongest
//                                              signal of the three
//
// That third case is the one the literature is about. Of notes containing
// duplicated text, 1.2% were judged on expert review to carry misleading
// information or major risk of harm, fraud or tort exposure — and copy-paste
// was implicated in diagnostic errors where 2.6% required patients to seek
// additional unplanned care.
// ===========================================================================
//
// This reports pairs and their properties. It does NOT decide that anyone did
// anything wrong; digest.ts turns counts into sentences, and even there the
// wording states what was found rather than what it means about a person.

import { extractFacts } from "@/lib/extract/extract";
import { affirmedSites } from "@/lib/extract/facts";

/** Five-word shingles. Long enough that shared stock phrases do not dominate. */
const SHINGLE = 5;

export interface NoteFingerprint {
  submissionId: number;
  authorId: string;
  noteType: string;
  shingles: Set<string>;
  /** Affirmed tooth ids, sorted, joined. Empty when the note names no tooth. */
  toothSignature: string;
  factCount: number;
  words: number;
}

function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{Nd}#\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function fingerprint(input: {
  submissionId: number;
  authorId: string;
  noteType: string;
  markdown: string;
}): NoteFingerprint {
  const words = normalize(input.markdown);
  const shingles = new Set<string>();
  for (let i = 0; i + SHINGLE <= words.length; i++) {
    shingles.add(words.slice(i, i + SHINGLE).join(" "));
  }
  // A note shorter than one shingle still needs a fingerprint; use the whole
  // thing so two identical one-liners can still match each other.
  if (shingles.size === 0 && words.length > 0) shingles.add(words.join(" "));

  const extraction = extractFacts(input.markdown);
  const teeth = affirmedSites(extraction)
    .map((s) => s.toothId)
    .sort();

  return {
    submissionId: input.submissionId,
    authorId: input.authorId,
    noteType: input.noteType,
    shingles,
    toothSignature: teeth.join(","),
    factCount: extraction.facts.length,
    words: words.length
  };
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let shared = 0;
  for (const s of small) if (large.has(s)) shared++;
  return shared / (a.size + b.size - shared);
}

export type DuplicateKind = "same-sites" | "no-facts";

export interface DuplicatePair {
  a: number;
  b: number;
  authorId: string;
  similarity: number;
  kind: DuplicateKind;
}

/**
 * Similarity at which two notes stop being "standardised" and start being "the
 * same note twice".
 *
 * Deliberately high. The cost of missing a copy-forward is that a Team Lead
 * does not hear about it this month; the cost of a false positive is a
 * conversation accusing someone of something they did not do, which is how a
 * quality tool becomes a surveillance tool nobody cooperates with.
 */
export const DUPLICATE_THRESHOLD = 0.95;

/**
 * Find near-duplicate pairs WITHIN each author's own notes of the same type.
 *
 * Scoped to one author on purpose. Two hygienists producing similar prophy
 * notes is standardisation succeeding and is none of this function's business.
 * The concern is one person's note reappearing under a different patient.
 */
export function duplicatePairs(prints: NoteFingerprint[]): DuplicatePair[] {
  const groups = new Map<string, NoteFingerprint[]>();
  for (const p of prints) {
    const key = `${p.authorId}\u0000${p.noteType}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }

  const pairs: DuplicatePair[] = [];
  for (const group of groups.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        // Cheap prefilter: sets differing by more than 25% in size cannot reach
        // a 0.95 Jaccard, so there is no point building the intersection.
        const ratio = Math.min(a.shingles.size, b.shingles.size) / Math.max(a.shingles.size, b.shingles.size, 1);
        if (ratio < DUPLICATE_THRESHOLD) continue;

        const similarity = jaccard(a.shingles, b.shingles);
        if (similarity < DUPLICATE_THRESHOLD) continue;

        // The discriminator. Different teeth means the template varied where it
        // should, and that is not a finding.
        const sameSites = a.toothSignature === b.toothSignature && a.toothSignature !== "";
        const noFacts = a.factCount === 0 && b.factCount === 0;
        if (!sameSites && !noFacts) continue;

        pairs.push({
          a: a.submissionId,
          b: b.submissionId,
          authorId: a.authorId,
          similarity,
          kind: sameSites ? "same-sites" : "no-facts"
        });
      }
    }
  }
  return pairs.sort((x, y) => y.similarity - x.similarity || x.a - y.a);
}
