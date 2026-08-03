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

// ---------------------------------------------------------------------------
// Safety block: the fields where "nothing to report" is the dangerous answer.
//
// A blank allergy box means "we do not know". "No known drug allergies" means
// somebody asked and the answer was none — an affirmative clinical claim, and
// the one a later reader leans on before prescribing. The two are not the same
// fact, and a form that lets the second happen by default is a form that
// manufactures it.
//
// So each of these carries an explicit status (never a bare yes/no "reviewed"
// tick) and, when the status is a negative, a separate confirmation saying
// whether it was asked TODAY or carried forward. Tennessee requires a concise
// medical history sufficient for a later dentist to continue care; carried
// forward and asked-today are different levels of evidence for that, and only
// the person in the room knows which one applies.

/** The literal stored for each negative status — referenced by visibleIf. */
export const NKA = "No known allergies of any kind (NKA).";
export const NKDA = "No known drug allergies (NKDA); other allergy types not excluded.";
export const NO_MEDICATIONS = "No current medications reported.";
export const NO_HISTORY_CHANGES = "No changes reported to the medical history.";
export const PREMED_NOT_REQUIRED = "Not required.";

export const ALLERGY_STATUS: FieldOption[] = [
  { value: NKA, label: "No known allergies of any kind (NKA)" },
  { value: NKDA, label: "No known DRUG allergies (NKDA) — other types not excluded" },
  {
    value: "Allergies on file; see the allergy list in the clinical system.",
    label: "Allergies on file (details stay in the EDR)"
  },
  {
    value: "Allergy history not reviewed at this visit.",
    label: "Not reviewed at this visit"
  }
];

export const MEDICATION_STATUS: FieldOption[] = [
  { value: NO_MEDICATIONS, label: "None reported" },
  {
    value: "Medication list reviewed; see the medication list in the clinical system.",
    label: "List reviewed (details stay in the EDR)"
  },
  {
    value: "Medication list not reviewed at this visit.",
    label: "Not reviewed at this visit"
  }
];

export const NEGATIVE_STATUS_HISTORY: FieldOption[] = [
  { value: NO_HISTORY_CHANGES, label: "No changes reported" },
  { value: "Changes reported; see below.", label: "Changes reported" },
  { value: "Medical history not reviewed at this visit.", label: "Not reviewed at this visit" }
];

export const PREMEDICATION_STATUS: FieldOption[] = [
  { value: PREMED_NOT_REQUIRED, label: "Not required" },
  { value: "Required; taken before the appointment as directed.", label: "Required — taken" },
  {
    // Deliberately blunt. This is a stop-and-ask, not a note written afterwards.
    value: "Required; NOT taken. Dentist notified before treatment.",
    label: "Required — NOT taken (tell the dentist now)"
  },
  {
    value: "Premedication requirement not reviewed at this visit.",
    label: "Not reviewed at this visit"
  }
];

// The double-check itself. Deliberately not a yes/no tick: the useful
// distinction is not "did you confirm" (everyone ticks yes) but WHAT the
// confirmation rests on, and carrying a negative forward unasked is the
// specific failure that puts a stale "no allergies" in front of a prescriber.
export const CONFIRM_ASKED: FieldOption[] = [
  {
    value: "Confirmed with the patient at this visit and checked against the chart.",
    label: "Asked the patient at this visit AND checked the chart"
  },
  {
    value: "Confirmed with the patient at this visit.",
    label: "Asked the patient at this visit"
  },
  {
    value: "Carried forward from the chart; not re-confirmed with the patient at this visit.",
    label: "Carried forward from the chart — not re-asked at this visit"
  }
];
