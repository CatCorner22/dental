import type { OverallStatus } from "@/lib/audit/types";

export interface SubmissionStamp {
  ticket: string;
  submittedBy: string; // "Display Name (username)"
  submittedAtEt: string; // from formatEasternTime
  ruleVersion: string;
  auditStatus: OverallStatus;
  /**
   * The office this encounter happened at, frozen at file time.
   *
   * Optional because a note can be filed before the practice has configured
   * any offices, and because the record must not gain a line asserting
   * "Unknown" — a placeholder in a legal record reads as a finding about the
   * visit rather than a gap in the software.
   */
  officeName?: string | null;
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
    ...(s.officeName ? [`- Office: ${s.officeName}`] : []),
    `- Submitted (US Eastern): ${s.submittedAtEt}`,
    `- Ruleset version: ${s.ruleVersion}`,
    `- Audit status at submission: ${s.auditStatus}`,
    "",
    "This entry may form part of a legal and medical record. It contains no patient identifiers; complete all identifiers, exact dates, and signatures in the EDR."
  ].join("\n");
}
