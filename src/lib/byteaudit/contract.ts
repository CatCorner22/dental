// THE CONTRACT: what the application promises, written down where the
// application cannot reach it.
//
// ByteAudit's whole value is that it does not believe anything the app says. So
// it cannot import the app's constants, call the app's composer, or re-use the
// app's audit engine — if it did, a bug in any of those would be reproduced
// identically on both sides of the comparison and cancel itself out. A verifier
// that shares an assumption with the thing it verifies cannot see that
// assumption fail.
//
// Instead the promises are restated here, from scratch, in this file. The
// duplication is the mechanism, not an oversight. When the app changes its
// stamp format and ByteAudit starts refusing, that is the design working: two
// independent statements of the same truth disagreed, and a human is now
// required to say which one is right.
//
// This is double-entry bookkeeping. The books are kept twice, by parties that do
// not talk to each other, and publication requires them to agree.
//
// SCOPE, STATED HONESTLY. ByteAudit reads the FINAL ARTIFACT — the frozen note,
// the frozen audit report, and the record row that claims to describe them. It
// verifies internal consistency and structural completeness of that artifact. It
// cannot verify clinical correctness, it cannot confirm an email was delivered
// (nothing in the record says so), and it is not a second clinician. Those
// limits are enumerated in LIMITS below so no screen can imply otherwise.

/**
 * A step the application performs between "user pressed submit" and "this is a
 * filed record", each with the evidence ByteAudit demands as proof it happened.
 *
 * The list is deliberately about EVIDENCE rather than about execution. ByteAudit
 * was not present when the step ran and has no log to trust; the only thing it
 * can do is look at the artifact and ask whether a step that truly completed
 * would have left this behind.
 */
export interface PipelineStep {
  id: string;
  /** What the application undertakes to do. */
  promise: string;
  /** What must be visible in the final artifact if it actually happened. */
  evidence: string;
  /**
   * What it means if the evidence is absent.
   *
   * Written as a consequence rather than a rule name, because the person reading
   * a refusal needs to know what is wrong with the record in front of them.
   */
  ifAbsent: string;
}

/**
 * Every step ByteAudit knows how to check.
 *
 * Derived from tracing the submit path, and deliberately restated rather than
 * imported. If a step is added to the application and not added here, the
 * completeness check below reports fewer steps than the app performs — which is
 * why COVERAGE is asserted against this list in the tests rather than inferred.
 */
export const PIPELINE_STEPS: readonly PipelineStep[] = [
  {
    id: "ticket-issued",
    promise: "Every filing receives a sequential ticket in DN-000000 form.",
    evidence: "A ticket matching /^DN-\\d{6}$/ appears in the record row.",
    ifAbsent: "The filing has no reference anyone can quote, so it cannot be found again."
  },
  {
    id: "ticket-agrees",
    promise: "The same ticket is stamped into the note and into the audit report.",
    evidence: "Both frozen documents carry a '- Ticket:' line, and both say the same thing.",
    ifAbsent:
      "The note and the report describing it are not provably the same filing — the pair may have been assembled from two different submissions."
  },
  {
    id: "note-frozen",
    promise: "The composed note is frozen as an immutable copy at submit time.",
    evidence: "The stored note text is non-empty and carries the submission stamp.",
    ifAbsent:
      "A torn write left a ticket pointing at no note. The record exists and says nothing."
  },
  {
    id: "audit-frozen",
    promise: "The audit report is frozen alongside the note and never rewritten.",
    evidence: "The stored audit report is non-empty and carries the same stamp.",
    ifAbsent: "The note was filed with no record of what the audit said about it at the time."
  },
  {
    id: "ruleset-stamped",
    promise: "The ruleset version that judged the note is recorded on the note itself.",
    evidence:
      "The stamp's '- Ruleset version:' line matches the record row's stored rule version.",
    ifAbsent:
      "Nobody can tell which rules ran, so the audit result cannot be reproduced or challenged."
  },
  {
    id: "audit-version-stamped",
    promise: "The audit report names the checker that produced it.",
    evidence: "The report contains 'deterministic-checker <version>' agreeing with the stamp.",
    ifAbsent: "The report cannot be tied to the ruleset that generated it."
  },
  {
    id: "status-agrees",
    promise: "The audit status on the record matches the status inside the frozen report.",
    evidence: "The row's status string appears as the report's declared status.",
    ifAbsent:
      "The index and the document disagree about whether this note passed — and the index is what people search."
  },
  {
    id: "status-known",
    promise: "The audit status is one of the four defined outcomes.",
    evidence: "The status string is a member of the known set.",
    ifAbsent: "An unrecognized status cannot be acted on and may be a truncated or corrupted write."
  },
  {
    id: "gate-honoured",
    promise: "Nothing files while a stop or a required finding is unresolved.",
    evidence:
      "The declared status is not BLOCKED, or an explicit attestation section is present in the report.",
    ifAbsent: "A note that the tool's own gate should have stopped was filed anyway."
  },
  {
    id: "time-stamped",
    promise: "The filing time is recorded in US Eastern, with the zone resolved.",
    evidence: "A timestamp of the form YYYY-MM-DD HH:MM EST|EDT appears in the stamp and the row.",
    ifAbsent:
      "A record with no reliable time is a record whose sequence cannot be established later."
  },
  {
    id: "author-stamped",
    promise: "The submitting person is named on the frozen note.",
    evidence: "The stamp carries a '- Submitted by:' line with a non-empty value.",
    ifAbsent: "The record does not say who filed it."
  },
  {
    id: "attestation-complete",
    promise: "A privacy override is recorded with its reason and its author, or not at all.",
    evidence:
      "If the report contains an override section, it names both a reason and the person who attested.",
    ifAbsent:
      "A privacy stop was waived and the record does not say by whom or why, which is the one case where the override is worse than the stop."
  },
  {
    id: "legal-notice-present",
    promise: "Every frozen note carries the legal-record notice.",
    evidence: "The stamp's closing notice text is present.",
    ifAbsent: "A reader may not realize what this document is."
  }
] as const;

/**
 * The four outcomes the audit is allowed to reach.
 *
 * Restated here rather than imported from the audit engine, on purpose: if the
 * app grows a fifth status, ByteAudit should refuse it until a human has decided
 * that the new status is legitimate and taught it here. Silent acceptance of an
 * unrecognized verdict is exactly the failure this component exists to prevent.
 */
export const KNOWN_STATUSES: readonly string[] = [
  "BLOCKED",
  "NEEDS CLINICIAN ACTION",
  "READY FOR CLINICIAN REVIEW",
  "AUDIT PASS — CLINICIAN REVIEW STILL REQUIRED"
];

/**
 * What ByteAudit cannot tell you, stated so no screen can imply otherwise.
 *
 * A backstop that is trusted beyond its evidence is more dangerous than no
 * backstop, because it converts "nobody checked" into "something checked and
 * said it was fine". These are rendered next to any pass verdict.
 */
export const LIMITS: readonly string[] = [
  "It reads the filed artifact only. It was not present when the steps ran and trusts no log.",
  "It cannot judge clinical correctness. A note can be internally perfect and clinically wrong.",
  "It cannot confirm the email arrived. Nothing in the record states delivery.",
  "It is not a clinician's review and does not replace one.",
  "A pass means the record is internally consistent and structurally complete. Nothing more."
];
