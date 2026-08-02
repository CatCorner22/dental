import type { OverallStatus } from "@/lib/audit/types";

export interface SubmissionStamp {
  ticket: string;
  submittedBy: string; // "Display Name (username)"
  submittedAtEt: string; // from formatEasternTime
  ruleVersion: string;
  auditStatus: OverallStatus;
}

// The traceability block appended to every submitted note and audit report,
// and frozen into the submissions record. Deterministic and PII-free (staff
// identity is a role/name for traceability, never patient data).
export function composeStamp(s: SubmissionStamp): string {
  return [
    "",
    "---",
    "",
    "## Submission record",
    "",
    `- Ticket: ${s.ticket}`,
    `- Submitted by: ${s.submittedBy}`,
    `- Submitted (US Eastern): ${s.submittedAtEt}`,
    `- Ruleset version: ${s.ruleVersion}`,
    `- Audit status at submission: ${s.auditStatus}`,
    "",
    "This entry may form part of a legal and medical record. It contains no patient identifiers; complete all identifiers, exact dates, and signatures in the EDR."
  ].join("\n");
}
