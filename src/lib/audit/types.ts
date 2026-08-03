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

/**
 * What a severity means, in a sentence, for the person reading it.
 *
 * The labels above are the practice's formal audit vocabulary and they stay. These
 * are for the screen. A usability review of the builder found the panel rendering
 * "S1 REQUIRED" — the internal code AND the label — and a non-clinical reviewer read
 * it as an error code they had done something to deserve. The code is taxonomy for
 * the ruleset and the frozen report; it is not an instruction to a human.
 *
 * Each one says what happens next, because that is the only question the reader has.
 */
export const SEVERITY_MEANING: Record<Severity, string> = {
  S0: "Must be fixed. This blocks copying and filing.",
  S1: "Needed before this note can be filed.",
  S2: "Worth a look before you file. Does not block.",
  S3: "Wording only. Does not block.",
  S4: "For information. Does not block."
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
  | "stigmatizing"
  | "plain-language"
  | "spelling"
  | "measurement"
  | "medication-safety";

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

// One severity ramp, used by every surface that renders a finding.
//
// This existed twice — `SEVERITY_STYLES` in AuditPanel.tsx and `SEV_CLASS` in
// Standardizer.tsx — and the two had drifted apart at S3 and S4. The SAME
// finding rendered blue in the note builder and grey on the Standardize page,
// which quietly told a clinician that an informational item was a different
// KIND of item depending on which screen they happened to be looking at.
// Severity is the app's core safety vocabulary; it cannot mean two things.
export const SEVERITY_CLASS: Record<Severity, string> = {
  S0: "border-red-300 bg-red-50 text-red-900",
  S1: "border-orange-300 bg-orange-50 text-orange-900",
  S2: "border-amber-300 bg-amber-50 text-amber-900",
  S3: "border-blue-200 bg-blue-50 text-blue-900",
  S4: "border-slate-200 bg-slate-50 text-slate-700"
};

// The overall-status banner, keyed on OverallStatus so a renamed status is a
// type error rather than an unstyled banner.
export const STATUS_CLASS: Record<OverallStatus, string> = {
  BLOCKED: "border-red-300 bg-red-100 text-red-900",
  "NEEDS CLINICIAN ACTION": "border-orange-300 bg-orange-100 text-orange-900",
  "READY FOR CLINICIAN REVIEW": "border-amber-300 bg-amber-100 text-amber-900",
  "AUDIT PASS — CLINICIAN REVIEW STILL REQUIRED": "border-green-300 bg-green-100 text-green-900"
};
