import type { ModuleDef } from "@/lib/schema/types";
import {
  ALLERGY_STATUS,
  CARE_STATUS,
  CONFIRM_ASKED,
  EDR_ONLY_STATUS,
  EVIDENCE_PHRASES,
  MEDICATION_STATUS,
  NEGATIVE_STATUS_HISTORY,
  NKA,
  NKDA,
  NONE_REPORTED,
  NO_HISTORY_CHANGES,
  NO_MEDICATIONS,
  PATIENT_DECISION,
  PREMEDICATION_STATUS,
  PREMED_NOT_REQUIRED,
  YES_NO,
  opts
} from "./shared";

export const universalCore: ModuleDef = {
  id: "universal-core",
  title: "Universal Core",
  order: 0,
  alwaysOn: true,
  description: "Every encounter uses this module. Add-on modules extend it.",
  sections: [
    {
      id: "visit",
      title: "Visit",
      fields: [
        {
          id: "encounter-type",
          type: "select",
          label: "Encounter type",
          required: true,
          options: opts(
            "comprehensive examination",
            "periodic examination",
            "limited examination",
            "consultation",
            "recall visit",
            "treatment visit",
            "emergency visit",
            "postoperative visit",
            "teledentistry encounter"
          ),
          allowOther: true
        },
        {
          id: "visit-purpose",
          type: "text",
          label: "Visit purpose",
          required: true,
          placeholderHint: "<patient-reported words, de-identified>",
          helpText: "Use the patient's de-identified words."
        },
        {
          id: "interval-events",
          type: "text",
          label: "Interval events",
          standardPhrases: [NONE_REPORTED, "The patient reports ", "The external record states "]
        },
        {
          id: "source-limits",
          type: "text",
          label: "Source and reliability limits",
          standardPhrases: ["Not applicable.", "The history source is limited because "]
        }
      ]
    },
    {
      id: "history-review",
      title: "Medical and dental review",
      fields: [
        {
          id: "history-reviewed",
          type: "select",
          label: "History reviewed in the clinical system",
          required: true,
          options: YES_NO
        },
        {
          id: "history-changes-status",
          type: "select",
          label: "Medical history changes",
          required: true,
          options: NEGATIVE_STATUS_HISTORY,
          helpText:
            '"No changes" is a statement about the patient, not an empty box. Say it only if you asked.'
        },
        {
          id: "history-changes-confirm",
          type: "select",
          label: "Double-check: no history changes",
          options: CONFIRM_ASKED,
          visibleIf: { fieldId: "history-changes-status", equals: NO_HISTORY_CHANGES },
          requiredIf: { fieldId: "history-changes-status", equals: NO_HISTORY_CHANGES },
          helpText: "Carried forward without asking is a different fact. Say which this is."
        },
        {
          id: "history-changes",
          type: "text",
          label: "Changes reported",
          visibleIf: { fieldId: "history-changes-status", notEquals: NO_HISTORY_CHANGES },
          standardPhrases: [NONE_REPORTED, "The patient reports "]
        },
        {
          id: "allergies-status",
          type: "select",
          label: "Allergy status",
          required: true,
          options: ALLERGY_STATUS,
          helpText:
            "NKA and NKDA are DIFFERENT statements. NKDA covers drugs only — a latex or food allergy can still exist. Pick the one you actually verified."
        },
        {
          id: "allergies-confirm",
          type: "select",
          label: "Double-check: no known allergies",
          options: CONFIRM_ASKED,
          visibleIf: { fieldId: "allergies-status", in: [NKA, NKDA] },
          requiredIf: { fieldId: "allergies-status", in: [NKA, NKDA] },
          helpText:
            "A negative allergy statement is an affirmative clinical claim, and it is the one a later reader relies on before prescribing. It gets its own confirmation."
        },
        {
          id: "medications-status",
          type: "select",
          label: "Current medications",
          required: true,
          options: MEDICATION_STATUS,
          helpText: "The medication list itself stays in the EDR."
        },
        {
          id: "medications-confirm",
          type: "select",
          label: "Double-check: no current medications",
          options: CONFIRM_ASKED,
          visibleIf: { fieldId: "medications-status", equals: NO_MEDICATIONS },
          requiredIf: { fieldId: "medications-status", equals: NO_MEDICATIONS },
          helpText:
            "\"None\" is the answer most often carried forward unasked, and the one that hides an interaction."
        },
        {
          id: "premedication-status",
          type: "select",
          label: "Antibiotic premedication",
          required: true,
          options: PREMEDICATION_STATUS,
          helpText:
            "Required-and-not-taken is a reason to stop and ask the dentist, not a note to write afterwards."
        },
        {
          id: "premedication-confirm",
          type: "select",
          label: "Double-check: premedication not required",
          options: CONFIRM_ASKED,
          visibleIf: { fieldId: "premedication-status", equals: PREMED_NOT_REQUIRED },
          requiredIf: { fieldId: "premedication-status", equals: PREMED_NOT_REQUIRED },
          helpText:
            "Prophylaxis turns on cardiac and joint history. If that history was not reviewed at this visit, say so rather than implying it was."
        },
        {
          id: "relevant-conditions",
          type: "textarea",
          label:
            "Relevant conditions, surgeries, pregnancy, substance use, and prior anesthesia events",
          placeholderHint: "<de-identified clinical facts>",
          standardPhrases: EVIDENCE_PHRASES
        },
        {
          id: "dental-history",
          type: "textarea",
          label: "Relevant dental history and risk factors",
          placeholderHint: "<facts>"
        },
        {
          id: "clearance-status",
          type: "text",
          label: "Consultation or clearance status",
          standardPhrases: ["Not applicable.", "Unresolved."]
        }
      ]
    },
    {
      id: "subjective",
      title: "Subjective",
      fields: [
        { id: "site", type: "text", label: "Site", placeholderHint: "<region/tooth/surface>" },
        { id: "symptom", type: "text", label: "Symptom", placeholderHint: "<value>" },
        {
          id: "onset-course",
          type: "text",
          label: "Onset and course",
          placeholderHint: "<relative duration, not an identifying date>"
        },
        {
          id: "severity",
          type: "text",
          label: "Severity and scale",
          placeholderHint: "<value>",
          standardPhrases: ["The patient rates the pain <0-10> of 10.", "The patient reports no pain."]
        },
        { id: "quality", type: "text", label: "Quality", placeholderHint: "<value>" },
        {
          id: "triggers-relief",
          type: "text",
          label: "Triggers and relief",
          placeholderHint: "<value>"
        },
        {
          id: "associated-symptoms",
          type: "text",
          label: "Associated symptoms",
          standardPhrases: [NONE_REPORTED]
        },
        {
          id: "pertinent-negatives",
          type: "text",
          label: "Pertinent negatives reported",
          standardPhrases: ["The patient reports no "]
        },
        { id: "patient-goal", type: "text", label: "Patient goal", placeholderHint: "<value>" }
      ]
    },
    {
      id: "objective",
      title: "Objective",
      fields: [
        {
          id: "general-observation",
          type: "text",
          label: "General observation",
          placeholderHint: "<specific finding>"
        },
        {
          id: "extraoral",
          type: "textarea",
          label: "Extraoral examination",
          placeholderHint: "<specific structures and findings>",
          standardPhrases: ["Not assessed.", "The clinician observed "]
        },
        {
          id: "intraoral-soft-tissue",
          type: "textarea",
          label: "Intraoral soft-tissue examination",
          placeholderHint: "<specific structures and findings>",
          standardPhrases: ["Not assessed.", "The clinician observed "]
        },
        {
          id: "dentition-hard-tissue",
          type: "textarea",
          label: "Dentition and hard-tissue examination",
          placeholderHint: "<tooth/site/surface and finding>"
        },
        {
          id: "periodontal-screening",
          type: "text",
          label: "Periodontal screening or examination",
          placeholderHint: "<method and findings>"
        },
        {
          id: "occlusion-function",
          type: "text",
          label: "Occlusion and function",
          placeholderHint: "<finding>"
        },
        {
          id: "tests",
          type: "textarea",
          label: "Tests",
          placeholderHint: "<name, site, method, result, control, limitation>",
          standardPhrases: ["Not assessed."]
        },
        {
          id: "images",
          type: "text",
          label: "Images",
          standardPhrases: ["See the Imaging add-on.", "No image was acquired at this encounter."],
          helpText: "Add the Imaging add-on for any image acquired, received, or interpreted."
        },
        {
          id: "exam-limits",
          type: "text",
          label: "Examination limits",
          standardPhrases: ["Not applicable."]
        }
      ]
    },
    {
      id: "assessment",
      title: "Assessment",
      fields: [
        {
          id: "diagnosis",
          type: "text",
          label: "Clinician-supplied diagnosis",
          required: true,
          placeholderHint: "<exact term>",
          helpText: "The clinician supplies the diagnosis. This tool never suggests one."
        },
        {
          id: "diagnosis-status",
          type: "select",
          label: "Diagnosis status",
          required: true,
          options: opts("final", "working", "differential")
        },
        {
          id: "site-extent",
          type: "text",
          label: "Tooth, site, surface, extent, stage, grade, or severity",
          placeholderHint: "<when applicable>"
        },
        {
          id: "supporting-evidence",
          type: "text",
          label: "Supporting evidence",
          placeholderHint: "<fact>"
        },
        {
          id: "unresolved-evidence",
          type: "text",
          label: "Unresolved evidence or differential",
          standardPhrases: [NONE_REPORTED, "Unresolved: "]
        },
        {
          id: "prognosis",
          type: "text",
          label: "Prognosis and basis",
          placeholderHint: "<clinician-supplied fact>"
        },
        {
          id: "diagnostic-code",
          type: "text",
          label: "Current licensed diagnostic terminology or code",
          standardPhrases: ["Completed in the EDR from the licensed code set."],
          helpText: "Do not type licensed codes from memory. Verify locally."
        }
      ]
    },
    {
      id: "plan",
      title: "Plan and decision",
      fields: [
        {
          id: "recommended-care",
          type: "textarea",
          label: "Recommended care and purpose",
          required: true,
          placeholderHint: "<fact>"
        },
        { id: "expected-benefit", type: "text", label: "Expected benefit", placeholderHint: "<fact>" },
        { id: "material-risks", type: "text", label: "Material risks", placeholderHint: "<fact>" },
        { id: "alternatives", type: "text", label: "Alternatives", placeholderHint: "<fact>" },
        {
          id: "no-treatment-option",
          type: "text",
          label: "No-treatment option and likely consequence",
          placeholderHint: "<fact>"
        },
        {
          id: "questions-discussed",
          type: "text",
          label: "Questions discussed",
          standardPhrases: ["The clinician answered the patient's stated questions."]
        },
        {
          id: "patient-decision",
          type: "select",
          label: "Patient decision",
          required: true,
          options: PATIENT_DECISION
        },
        {
          id: "consent-form-status",
          type: "select",
          label: "Consent or refusal form status",
          options: EDR_ONLY_STATUS,
          helpText: "Complete the form itself only in the EDR."
        },
        { id: "planned-sequence", type: "text", label: "Planned sequence", placeholderHint: "<fact>" }
      ]
    },
    {
      id: "care-delivered",
      title: "Care delivered",
      fields: [
        {
          id: "procedure-status",
          type: "select",
          label: "Procedure status",
          required: true,
          options: CARE_STATUS,
          helpText: "Use the exact state. Do not collapse states."
        },
        {
          id: "complication-status",
          type: "text",
          label: "Complication status",
          required: true,
          standardPhrases: [
            "No complication was observed during the stated procedure and observation period.",
            "Complication: "
          ]
        },
        {
          id: "patient-response",
          type: "text",
          label: "Patient response",
          placeholderHint: "<objective observation and patient report>"
        }
      ]
    },
    {
      id: "handoff",
      title: "Handoff",
      fields: [
        {
          id: "condition-at-end",
          type: "text",
          label: "Condition at end of visit",
          placeholderHint: "<specific findings>"
        },
        {
          id: "instructions",
          type: "textarea",
          label: "Instructions",
          placeholderHint: "<topic and delivery method>",
          standardPhrases: [
            "The clinician gave verbal and written postoperative instructions and confirmed teach-back."
          ]
        },
        {
          id: "return-precautions",
          type: "textarea",
          label: "Return precautions",
          placeholderHint: "<exact trigger and action>",
          standardPhrases: [
            "Call the office if swelling spreads, breathing or swallowing becomes hard, bleeding does not stop with pressure for 30 minutes, or fever develops. Seek emergency care if breathing is blocked."
          ]
        },
        {
          id: "medication-link",
          type: "text",
          label: "Medication or prescription",
          standardPhrases: ["See the Medication and Prescription add-on.", "None."]
        },
        {
          id: "follow-up",
          type: "text",
          label: "Follow-up interval and purpose",
          placeholderHint: "<value>"
        },
        {
          id: "referral",
          type: "text",
          label: "Referral or communication",
          placeholderHint: "<role, reason, urgency, status>",
          standardPhrases: ["None."]
        },
        {
          id: "signature-status",
          type: "select",
          label: "Author, reviewer, attestation, and signature",
          options: opts("to be completed in the EDR only"),
          helpText: "Names, credentials, and signatures never enter this tool."
        }
      ]
    }
  ]
};
