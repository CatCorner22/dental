import type { FieldOption, ToothPickerField } from "@/lib/schema/types";

export function opts(...values: string[]): FieldOption[] {
  return values.map((value) => ({ value }));
}

// An OPTIONAL, validated tooth field for procedural modules whose site is a
// natural tooth some of the time but not always (a crown is on a tooth; a
// biopsy usually is not). Keeping it optional means a clinician is never forced
// to invent a tooth number for soft-tissue or edentulous work — but when the
// site IS a tooth, it is captured through the validated picker instead of free
// text, which is what puts it under the wrong-site poka-yoke (invalid-tooth and
// surface-orphan are S0 in runAnatomyStateRule). The existing free-text site
// field stays alongside it for the nuance a picker cannot hold: pontic spans,
// edentulous sites, abutment vs. natural-tooth distinctions, lesion regions.
export function optionalTeeth(id: string, label: string, helpText?: string): ToothPickerField {
  return {
    id,
    type: "toothPicker",
    label,
    required: false,
    dentitions: ["permanent", "primary", "supernumerary-permanent", "supernumerary-primary"],
    multiple: true,
    ...(helpText ? { helpText } : {})
  };
}

export const YES_NO = opts("yes", "no");

// Data states from the controlled terminology. A blank never means normal.
export const DATA_STATES = opts(
  "present",
  "absent",
  "not assessed",
  "not applicable",
  "unknown",
  "unresolved"
);

// Procedure states — do not collapse these.
export const PROCEDURE_STATES = opts(
  "recommended",
  "planned",
  "authorized",
  "consented",
  "started",
  "completed",
  "partly completed",
  "stopped",
  "deferred",
  "declined"
);

export const CARE_STATUS = opts(
  "started",
  "completed",
  "partly completed",
  "stopped",
  "deferred"
);

export const PATIENT_DECISION = opts(
  "accepted",
  "declined",
  "deferred",
  "requested another option"
);

export const EDR_ONLY_STATUS = opts(
  "recorded in the EDR",
  "pending in the EDR",
  "not applicable"
);

// Evidence-source stems for free-text phrase chips.
export const EVIDENCE_PHRASES = [
  "The clinician observed ",
  "The patient reports ",
  "The parent or guardian reports ",
  "The external record states ",
  "The test result shows ",
  "The image interpretation states ",
  "Not assessed.",
  "Not applicable.",
  "Unknown.",
  "Unresolved."
];

export const NONE_REPORTED = "None reported.";
