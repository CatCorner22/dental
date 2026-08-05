import type { ClinicalRole } from "@/lib/auth/clinicalRoles";
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
  /**
   * The date the audit is being run, as ISO yyyy-mm-dd. Defaults to the real
   * date at the call site.
   *
   * An INPUT rather than a clock read, because one rule (supervision.pc1107)
   * changes behaviour on an effective date, and a rule that read the wall
   * clock inside the engine would make the same note audit differently on two
   * days with nothing in the inputs to show why. Passing the date keeps every
   * audit a pure function of its arguments, which is what lets tests pin both
   * sides of the boundary.
   */
  today?: string;
  /**
   * Writer's clinical role. When set, dentist-judgement coaching is tailored
   * away for auxiliaries who cannot author Assessment/Plan (see
   * tailorForAuthor.ts). Omit for text-only audits and frozen historical runs.
   */
  clinicalRole?: ClinicalRole;
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

/**
 * The severity as a LEFT RAIL rather than a full tinted box.
 *
 * A design review called the findings list "a wall of red shouting" and it was
 * right: every finding was a filled, bordered, tinted box stacked hard against the
 * next one, so eleven open required fields read as eleven alarms rather than as a
 * checklist of eleven things to type. A rail carries the same severity information
 * at a fraction of the visual weight, which is what lets a list of them be scanned
 * instead of endured.
 *
 * Same colours as above, deliberately — the palette is the audit vocabulary and it
 * does not get re-derived for a second presentation.
 */
export const SEVERITY_RAIL: Record<Severity, string> = {
  S0: "border-l-red-500 bg-red-50/60",
  S1: "border-l-orange-500 bg-orange-50/60",
  S2: "border-l-amber-500 bg-amber-50/60",
  S3: "border-l-blue-400 bg-blue-50/50",
  S4: "border-l-slate-400 bg-slate-50/60"
};

/** The severity word as a small chip. Glanceable, not a headline. */
export const SEVERITY_CHIP: Record<Severity, string> = {
  S0: "bg-red-600 text-white",
  S1: "bg-orange-600 text-white",
  S2: "bg-amber-500 text-amber-950",
  S3: "bg-blue-600 text-white",
  S4: "bg-slate-500 text-white"
};

// The overall-status banner, keyed on OverallStatus so a renamed status is a
// type error rather than an unstyled banner.
export const STATUS_CLASS: Record<OverallStatus, string> = {
  BLOCKED: "border-red-300 bg-red-100 text-red-900",
  "NEEDS CLINICIAN ACTION": "border-orange-300 bg-orange-100 text-orange-900",
  "READY FOR CLINICIAN REVIEW": "border-amber-300 bg-amber-100 text-amber-900",
  "AUDIT PASS — CLINICIAN REVIEW STILL REQUIRED": "border-green-300 bg-green-100 text-green-900"
};
