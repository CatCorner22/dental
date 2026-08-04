// THE LEARNING LEDGER — how this tool gets better, and where the learning lives.
//
// ===========================================================================
// THE DESIGN DECISION THIS FILE ENCODES
//
// A tool that improves from its own use is the right goal. The obvious
// mechanism — feed the practice's notes to a model and let its weights change —
// is the wrong one, and it fails on four separate counts at once:
//
//   PRIVACY.        Clinical free text in a training corpus is a HIPAA problem
//                   of the first order, and re-identification from narrative
//                   text is well documented. This application's entire premise
//                   is that note content does not leave the record.
//
//   REPRODUCIBILITY. The moment weights change, a note audited in March cannot
//                   be re-audited identically in June. That is the chain of
//                   custody, and it is the thing a practice is actually buying.
//
//   SELF-CONSUMPTION. Training on a corpus that already contains the tool's own
//                   accepted suggestions is a loop that feeds on itself. The
//                   distribution narrows toward whatever the tool already
//                   liked, which reads as improvement and is not.
//
//   ARITHMETIC.     One practice does not produce enough notes to move a
//                   model's weights in a direction anyone intended.
//
// SO THE LEARNING MOVES OUT OF THE WEIGHTS AND INTO THE TABLES.
//
// The tables — controlled vocabulary, procedure terms, audit rules, the clause
// grammar — are already the thing that decides what this tool understands. They
// are versioned, diffable, reviewable, and revertible. A change to them is a
// pull request, not a retrain. And a proposal to change them can be evidenced,
// ratified by a named human, stamped with a RULESET_VERSION, and MEASURED
// afterwards.
//
// That is real learning. It is slower per increment than gradient descent and
// it is the only kind that survives a subpoena.
// ===========================================================================
//
// NOTHING HERE APPLIES ITSELF. This module produces ranked proposals with
// evidence. A human ratifies; ratification produces a table diff for review.
// The same loop unknownAbbreviations.ts already uses, generalised — its header
// states the principle first and this file is that principle with more signals
// feeding it.

import { redactedContext } from "./redact";

export type ProposalKind =
  | "vocabulary" // a token the tables do not know
  | "grammar" // a phrase shape the parser cannot read
  | "rule-friction"; // a rule people override or work around

export type ProposalState = "observed" | "proposed" | "ratified" | "rejected" | "superseded";

export interface ProposalEvidence {
  /** Total appearances across the notes scanned. */
  occurrences: number;
  /** How many distinct notes. */
  notes: number;
  /**
   * How many distinct AUTHORS. The load-bearing number.
   *
   * One person's habit is not the practice's vocabulary, and — more
   * importantly for the redaction contract — a token one person used once
   * could be anything, including a name. A token four people used in nineteen
   * notes is jargon. The threshold is what licenses showing the token at all.
   */
  authors: number;
  /** Circulation-safe context lines. See redact.ts for why they look like that. */
  contexts: string[];
  /** ISO dates of the first and last sighting, for judging whether it is current. */
  firstSeen: string;
  lastSeen: string;
}

export interface Proposal {
  id: string;
  kind: ProposalKind;
  /** The token, phrase shape, or rule id this is about. */
  subject: string;
  /** One line stating what ratifying this would change. */
  effect: string;
  evidence: ProposalEvidence;
  state: ProposalState;
  /**
   * Set when ratified or rejected. The ledger records WHO, because a change to
   * what the tool understands is a clinical governance decision and an
   * unattributed one is worthless in a review.
   */
  decidedBy?: string;
  decidedAt?: string;
  /** The ruleset version the ratified change shipped in. */
  appliedInVersion?: string;
}

/**
 * Thresholds a signal must clear before it is shown to anyone.
 *
 * These are deliberately unglamorous integers and they do most of the safety
 * work in this module. Below them, a signal is noise: a typo, one person's
 * shorthand, a word from a referral letter that will never appear again. Above
 * them it is the practice's working language.
 *
 * MIN_AUTHORS is the one that matters most, and it is 2 rather than 1 for the
 * redaction reason in redact.ts as much as the statistical one.
 */
export const THRESHOLDS = {
  MIN_OCCURRENCES: 8,
  MIN_NOTES: 5,
  MIN_AUTHORS: 2,
  /** Contexts shown per proposal. Enough to judge, few enough to read. */
  MAX_CONTEXTS: 3
} as const;

export interface Sighting {
  /** Already-filed note text. Never a live draft. */
  text: string;
  authorId: string;
  filedAt: string;
}

export function meetsThreshold(evidence: ProposalEvidence): boolean {
  return (
    evidence.occurrences >= THRESHOLDS.MIN_OCCURRENCES &&
    evidence.notes >= THRESHOLDS.MIN_NOTES &&
    evidence.authors >= THRESHOLDS.MIN_AUTHORS
  );
}

/**
 * Build a proposal for one subject from the notes it appeared in.
 *
 * Returns undefined below threshold — deliberately, and without recording that
 * it was considered. A "rejected because too rare" list would be a second,
 * quieter copy of the same content with none of the protections.
 */
export function buildProposal(
  kind: ProposalKind,
  subject: string,
  effect: string,
  sightings: Sighting[]
): Proposal | undefined {
  if (sightings.length === 0) return undefined;

  const authors = new Set(sightings.map((s) => s.authorId));
  const dates = sightings.map((s) => s.filedAt).sort();
  const pattern = new RegExp(`\\b${escapeRegex(subject)}\\b`, "gi");
  const occurrences = sightings.reduce((sum, s) => sum + (s.text.match(pattern)?.length ?? 0), 0);

  const evidence: ProposalEvidence = {
    occurrences,
    notes: sightings.length,
    authors: authors.size,
    contexts: [],
    firstSeen: dates[0],
    lastSeen: dates[dates.length - 1]
  };

  if (!meetsThreshold(evidence)) return undefined;

  // Contexts are gathered only AFTER the threshold passes. Below threshold we
  // never build the string at all, so there is no window in which a
  // single-author snippet exists in memory as a shareable artifact.
  const contexts: string[] = [];
  const seen = new Set<string>();
  for (const s of sightings) {
    if (contexts.length >= THRESHOLDS.MAX_CONTEXTS) break;
    const ctx = redactedContext(s.text, subject);
    if (!ctx || seen.has(ctx)) continue;
    seen.add(ctx);
    contexts.push(ctx);
  }
  evidence.contexts = contexts;

  return {
    id: `${kind}:${subject.toLowerCase()}`,
    kind,
    subject,
    effect,
    evidence,
    state: "proposed"
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Rank proposals for a reviewer's attention.
 *
 * Breadth before depth: something four people say twice matters more than
 * something one person says eight times, because the first is a shared
 * convention and the second is a personal habit. Recency breaks ties, so a
 * reviewer is not shown a proposal about a material the practice stopped
 * stocking last year.
 */
export function rankProposals(proposals: Proposal[]): Proposal[] {
  return [...proposals].sort(
    (a, b) =>
      b.evidence.authors - a.evidence.authors ||
      b.evidence.notes - a.evidence.notes ||
      b.evidence.occurrences - a.evidence.occurrences ||
      b.evidence.lastSeen.localeCompare(a.evidence.lastSeen)
  );
}

/**
 * What a ratified change did, measured after the fact.
 *
 * THE HALF EVERY "LEARNING SYSTEM" SKIPS. Adding a vocabulary entry is trivial;
 * knowing whether it helped is the entire question, and a loop that never
 * closes is not learning, it is accumulation. A change that raised coverage
 * three points and left finding-rate flat is good. One that raised coverage and
 * doubled the STOP rate broke something, and the ledger has to be able to say
 * so plainly enough that reverting is the obvious move.
 */
export interface EffectMeasurement {
  proposalId: string;
  appliedInVersion: string;
  before: RulesetMetrics;
  after: RulesetMetrics;
}

export interface RulesetMetrics {
  /** Share of clauses the parser could read, 0..1. */
  coverage: number;
  /** Findings raised per note, by severity. */
  findingsPerNote: number;
  /** Share of required answers satisfied by an omission licence, 0..1. */
  omissionRate: number;
  notesSampled: number;
}

export type EffectVerdict = "improved" | "no-measurable-change" | "regressed" | "insufficient-data";

/**
 * Was that change good?
 *
 * Requires a real sample on both sides before it will answer. "Insufficient
 * data" is a first-class verdict rather than a shrug, because the alternative —
 * declaring victory on four notes — is how a feedback loop starts congratulating
 * itself.
 */
export function judgeEffect(m: EffectMeasurement, minSample = 20): EffectVerdict {
  if (m.before.notesSampled < minSample || m.after.notesSampled < minSample) return "insufficient-data";

  const coverageDelta = m.after.coverage - m.before.coverage;
  const omissionDelta = m.after.omissionRate - m.before.omissionRate;

  // A rise in omission rate is the signal that a change made the tool easier to
  // satisfy WITHOUT making notes better — staff reaching for "not applicable"
  // more often than before. It outranks a coverage gain, because coverage
  // measures what the tool understands and omission rate measures what the note
  // actually says.
  if (omissionDelta > 0.05) return "regressed";
  if (coverageDelta > 0.02) return "improved";
  if (coverageDelta < -0.02) return "regressed";
  return "no-measurable-change";
}
