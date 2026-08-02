import type { FieldOption } from "@/lib/schema/types";

export function opts(...values: string[]): FieldOption[] {
  return values.map((value) => ({ value }));
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
