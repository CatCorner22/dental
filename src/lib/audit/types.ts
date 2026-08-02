import type { ModuleDef, NoteState } from "@/lib/schema/types";

// Severity model from the formal audit pass in
// skill/assets/dental-note-templates.md. The audit never returns a
// percentage or claims a note is complete or compliant.

export type Severity = "S0" | "S1" | "S2" | "S3" | "S4";

export const SEVERITY_LABELS: Record<Severity, string> = {
  S0: "STOP",
  S1: "REQUIRED",
  S2: "REVIEW",
  S3: "STYLE",
  S4: "INFO"
};

export const SEVERITY_ORDER: Severity[] = ["S0", "S1", "S2", "S3", "S4"];

export type AuditCategory =
  | "phi"
  | "required"
  | "template-residue"
  | "stale-text"
  | "duplicate-text"
  | "anatomy"
  | "abbreviation"
  | "vague-phrase"
  | "spelling"
  | "measurement";

export interface AuditFinding {
  ruleId: string;
  category: AuditCategory;
  severity: Severity;
  message: string;
  fieldRef?: { moduleId: string; fieldId: string };
  matchedText?: string;
  suggestion?: string; // shown to the user; never auto-applied
  occurrences?: number;
}

export type OverallStatus =
  | "BLOCKED"
  | "NEEDS CLINICIAN ACTION"
  | "READY FOR CLINICIAN REVIEW"
  | "AUDIT PASS — CLINICIAN REVIEW STILL REQUIRED";

export interface AuditReport {
  findings: AuditFinding[]; // sorted S0 -> S4
  counts: Record<Severity, number>;
  status: OverallStatus;
  phiStops: AuditFinding[]; // category phi at S0
}

export interface AuditGates {
  // Copy and download: blocked by ANY S0 stop (jidoka — a defective note does
  // not leave the tool). A PHI stop is the one kind a person can waive, via
  // the explicit override dialog.
  exportAllowed: boolean;
  // Email: everything export requires, plus zero S1.
  emailAllowed: boolean;
}

export interface AuditContext {
  note: NoteState;
  modules: ModuleDef[]; // active modules
  composedText: string;
}
