// THE ADVERSARY: ByteAudit's verdict, re-derived from the artifact alone.
//
// Everything here parses the FINAL DOCUMENTS and compares what they say against
// what the record row claims about them. Nothing is imported from the composer,
// the stamp builder, the audit engine, or the ticket formatter — the patterns
// below are written out again from scratch, and that duplication is the entire
// mechanism. Two independent statements of the same truth have to agree before a
// note may be published; if they were the same statement, agreeing would prove
// nothing.
//
// PRO-USER, NOT PRO-SYSTEM. When this component is unsure, it refuses. That
// asymmetry is deliberate and it is the user's side of the argument: a person
// filing a clinical record is relying on the tool to have done what it said, and
// they have no way to check. A backstop that resolves doubt in the application's
// favour gives them a reassurance it has not earned. So an unparseable artifact
// is a REFUSAL, not a pass — the one thing that must never happen is a filed
// record that nobody actually verified but everybody believes was verified.
//
// It is also adversarial in a second, narrower sense: it assumes the artifact
// may have been assembled wrongly, and looks for the specific ways a partially
// completed pipeline still produces something that LOOKS finished. A ticket with
// an empty note. A report describing a different submission. A status on the row
// that disagrees with the status in the document. Each of those passes a casual
// eye and each is checked here by name.

import { KNOWN_STATUSES, LIMITS, PIPELINE_STEPS } from "./contract";

/**
 * The artifact, exactly as ByteAudit is willing to receive it.
 *
 * Deliberately primitive — strings and numbers, no application types. A shared
 * type is a shared assumption, and the moment ByteAudit accepts the app's own
 * `SubmissionRow` it inherits every guarantee that type is presumed to carry.
 * Passing plain strings forces it to re-establish everything itself.
 */
export interface FinalArtifact {
  /** The record row's own claims, which are exactly what is under suspicion. */
  claimed: {
    ticket: string;
    ruleVersion: string;
    auditStatus: string;
    submittedAtEt: string;
    submissionId: number;
  };
  /** The frozen note, stamp included. */
  frozenNote: string;
  /** The frozen audit report, stamp included. */
  frozenAudit: string;
}

export type Severity = "refuse" | "concern";

export interface Objection {
  stepId: string;
  severity: Severity;
  /** What is wrong, in a sentence a non-engineer can act on. */
  says: string;
  /** The consequence, taken from the contract. */
  because: string;
}

export interface ByteAuditVerdict {
  /** May this artifact be consolidated and published? */
  publish: boolean;
  objections: Objection[];
  /**
   * How many contract steps were actually examined.
   *
   * Compared against the contract's own length by the caller. A verifier that
   * silently skipped half its checks and returned "publish" is the failure mode
   * this field exists to make impossible — a pass is only a pass if every step
   * ran.
   */
  stepsChecked: number;
  stepsExpected: number;
  /** Rendered beside any pass, so the verdict is never read as more than it is. */
  limits: readonly string[];
}

// Patterns restated from scratch. If the application changes its stamp and these
// stop matching, ByteAudit refuses and a human decides who is right — which is
// the correct outcome, not a bug to be papered over by importing the app's copy.
const TICKET = /^DN-\d{6}$/;
const TICKET_LINE = /^- Ticket:\s*(DN-\d{6})\s*$/m;
const RULESET_LINE = /^- Ruleset version:\s*(.+?)\s*$/m;
const STATUS_LINE = /^- Audit status at submission:\s*(.+?)\s*$/m;
const SUBMITTED_BY_LINE = /^- Submitted by:\s*(.+?)\s*$/m;
const ET_LINE = /^- Submitted \(US Eastern\):\s*(.+?)\s*$/m;
const ET_SHAPE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2} E[SD]T$/;
const AUDIT_VERSION = /deterministic-checker\s+(\S+)/;
const REPORT_STATUS = /^-?\s*Status:\s*(.+?)\s*$/m;
const OVERRIDE_SECTION = /Privacy stops overridden by attestation/i;
const LEGAL_NOTICE = /may form part of a legal and medical record/i;

function firstGroup(re: RegExp, text: string): string | null {
  const m = re.exec(text);
  return m ? m[1].trim() : null;
}

/**
 * Judge one artifact.
 *
 * Pure, total, and free of I/O: the same artifact always produces the same
 * verdict, which is what lets a filed record be re-verified years later and get
 * the same answer. That property is the reason this is not a model.
 */
export function byteAuditVerify(artifact: FinalArtifact): ByteAuditVerdict {
  const objections: Objection[] = [];
  let checked = 0;

  const step = (id: string) => PIPELINE_STEPS.find((s) => s.id === id);
  const object = (stepId: string, severity: Severity, says: string) => {
    objections.push({ stepId, severity, says, because: step(stepId)?.ifAbsent ?? "" });
  };

  const { claimed, frozenNote, frozenAudit } = artifact;

  // ── ticket-issued ────────────────────────────────────────────────────────
  checked++;
  if (!TICKET.test(claimed.ticket)) {
    object("ticket-issued", "refuse", `The ticket "${claimed.ticket}" is not in DN-000000 form.`);
  } else if (
    Number.isInteger(claimed.submissionId) &&
    claimed.submissionId > 0 &&
    `DN-${String(claimed.submissionId).padStart(6, "0")}` !== claimed.ticket
  ) {
    // Re-derived independently rather than trusting formatTicket.
    object(
      "ticket-issued",
      "refuse",
      `The ticket ${claimed.ticket} does not match record number ${claimed.submissionId}.`
    );
  }

  // ── note-frozen / audit-frozen ───────────────────────────────────────────
  checked++;
  if (frozenNote.trim().length === 0) {
    object("note-frozen", "refuse", "The frozen note is empty.");
  }
  checked++;
  if (frozenAudit.trim().length === 0) {
    object("audit-frozen", "refuse", "The frozen audit report is empty.");
  }

  const noteTicket = firstGroup(TICKET_LINE, frozenNote);
  const auditTicket = firstGroup(TICKET_LINE, frozenAudit);

  // ── ticket-agrees ────────────────────────────────────────────────────────
  checked++;
  if (!noteTicket || !auditTicket) {
    object("ticket-agrees", "refuse", "One of the two documents carries no ticket line.");
  } else if (noteTicket !== auditTicket) {
    object(
      "ticket-agrees",
      "refuse",
      `The note is stamped ${noteTicket} and the audit report ${auditTicket}.`
    );
  } else if (noteTicket !== claimed.ticket) {
    object(
      "ticket-agrees",
      "refuse",
      `Both documents say ${noteTicket} but the record says ${claimed.ticket}.`
    );
  }

  // ── ruleset-stamped ──────────────────────────────────────────────────────
  checked++;
  const stampedRuleset = firstGroup(RULESET_LINE, frozenNote);
  if (!stampedRuleset) {
    object("ruleset-stamped", "refuse", "The note carries no ruleset version.");
  } else if (stampedRuleset !== claimed.ruleVersion) {
    object(
      "ruleset-stamped",
      "refuse",
      `The note was judged by ruleset ${stampedRuleset} but the record says ${claimed.ruleVersion}.`
    );
  }

  // ── audit-version-stamped ────────────────────────────────────────────────
  checked++;
  const checkerVersion = firstGroup(AUDIT_VERSION, frozenAudit);
  if (!checkerVersion) {
    object("audit-version-stamped", "refuse", "The audit report does not name the checker.");
  } else if (stampedRuleset && checkerVersion !== stampedRuleset) {
    object(
      "audit-version-stamped",
      "refuse",
      `The report was produced by checker ${checkerVersion} but the note is stamped ${stampedRuleset}.`
    );
  }

  // ── status-known / status-agrees ─────────────────────────────────────────
  checked++;
  if (!KNOWN_STATUSES.includes(claimed.auditStatus)) {
    object(
      "status-known",
      "refuse",
      `"${claimed.auditStatus}" is not an audit outcome this checker recognises.`
    );
  }

  checked++;
  const stampedStatus = firstGroup(STATUS_LINE, frozenNote);
  const reportStatus = firstGroup(REPORT_STATUS, frozenAudit);
  if (stampedStatus && stampedStatus !== claimed.auditStatus) {
    object(
      "status-agrees",
      "refuse",
      `The note says "${stampedStatus}" and the record says "${claimed.auditStatus}".`
    );
  } else if (!stampedStatus) {
    object("status-agrees", "refuse", "The note carries no audit status.");
  }
  if (reportStatus && reportStatus !== claimed.auditStatus) {
    object(
      "status-agrees",
      "concern",
      `The audit report declares "${reportStatus}" while the record says "${claimed.auditStatus}".`
    );
  }

  // ── gate-honoured ────────────────────────────────────────────────────────
  //
  // The one place ByteAudit second-guesses the outcome rather than the wiring.
  // A BLOCKED note reaching the filed state means the gate that was supposed to
  // stop it did not — unless a privacy attestation was recorded, which is the
  // single sanctioned way past it.
  checked++;
  if (claimed.auditStatus === "BLOCKED" && !OVERRIDE_SECTION.test(frozenAudit)) {
    object(
      "gate-honoured",
      "refuse",
      "This note is recorded as BLOCKED and carries no attestation, so it should never have filed."
    );
  }

  // ── time-stamped ─────────────────────────────────────────────────────────
  checked++;
  const stampedEt = firstGroup(ET_LINE, frozenNote);
  if (!ET_SHAPE.test(claimed.submittedAtEt)) {
    object(
      "time-stamped",
      "refuse",
      `"${claimed.submittedAtEt}" is not a US Eastern timestamp of the expected shape.`
    );
  }
  if (!stampedEt) {
    object("time-stamped", "refuse", "The note carries no submission time.");
  } else if (stampedEt !== claimed.submittedAtEt) {
    object(
      "time-stamped",
      "refuse",
      `The note is stamped ${stampedEt} and the record says ${claimed.submittedAtEt}.`
    );
  }

  // ── author-stamped ───────────────────────────────────────────────────────
  checked++;
  const author = firstGroup(SUBMITTED_BY_LINE, frozenNote);
  if (!author) {
    object("author-stamped", "refuse", "The note does not say who filed it.");
  }

  // ── attestation-complete ─────────────────────────────────────────────────
  //
  // Only inspected when an override is actually present. An override that names
  // neither a reason nor a person is worse than the stop it waived, because it
  // launders the decision into the record without attaching it to anyone.
  checked++;
  if (OVERRIDE_SECTION.test(frozenAudit)) {
    const hasReason = /reason/i.test(frozenAudit);
    const hasAttestor = /attested/i.test(frozenAudit);
    if (!hasReason || !hasAttestor) {
      object(
        "attestation-complete",
        "refuse",
        "A privacy stop was overridden without recording both a reason and the person attesting."
      );
    }
  }

  // ── legal-notice-present ─────────────────────────────────────────────────
  checked++;
  if (!LEGAL_NOTICE.test(frozenNote)) {
    object("legal-notice-present", "concern", "The note is missing the legal-record notice.");
  }

  return {
    publish: !objections.some((o) => o.severity === "refuse"),
    objections,
    stepsChecked: checked,
    stepsExpected: PIPELINE_STEPS.length,
    limits: LIMITS
  };
}

/**
 * The refusal, written for whoever is holding the note.
 *
 * Never a rule id on its own. Somebody is standing at a screen wanting to file,
 * and the only useful thing to tell them is what is wrong with this document and
 * what it costs — which is what the contract's `ifAbsent` sentences are for.
 */
export function explainVerdict(verdict: ByteAuditVerdict): string {
  if (verdict.publish && verdict.objections.length === 0) {
    return `ByteAudit checked ${verdict.stepsChecked} steps and found nothing wrong.`;
  }
  const head = verdict.publish
    ? "ByteAudit will allow this, with notes:"
    : "ByteAudit is refusing to publish this record.";
  return [
    head,
    ...verdict.objections.map(
      (o) => `  [${o.severity}] ${o.says}\n      why it matters: ${o.because}`
    )
  ].join("\n");
}
