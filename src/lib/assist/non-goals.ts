// STATED NON-GOALS OF THE AI LAYER.
//
// Four capabilities are repeatedly and reasonably proposed for a dental note
// assistant. Every one of them is a good idea in a product that is not this one,
// and each conflicts with a premise this application is built on. They are
// written down here, in code, with the reason and the safe alternative, because
// a decision that lives only in someone's memory gets re-litigated every few
// months and eventually one of these ships by accident.
//
// This file is asserted by non-goals.test.ts, which checks that the code paths
// they would require do not exist. That is the part that makes it more than a
// comment: an exclusion nothing enforces is a wish.

export interface NonGoal {
  id: string;
  /** The capability, stated the way someone proposing it would state it. */
  proposal: string;
  /** The premise it collides with. */
  conflict: string;
  /** What this application does instead, which is usually most of the value. */
  instead: string;
}

export const AI_NON_GOALS: readonly NonGoal[] = [
  {
    id: "patient-history-crossref",
    proposal:
      "Cross-reference the note against the patient's medical history in real time and raise a hard alert on an allergy or a contraindication — penicillin beside a penicillin prescription, a bisphosphonate before a planned extraction.",
    conflict:
      "It requires a patient record, and this application holds none. Drafts are de-identified by construction and the tool stores no identity, no history, and no link to one. Building this means giving Smile Notes a patient database, which is the one thing its entire privacy argument rests on not having.",
    instead:
      "The contraindication check belongs in the EDR, where the identities and the real medication list already live and where the practice's own clinical systems can act on it. What this tool does is the half that needs no patient record: a curated drug-interaction screen over the text of the note itself, flag-only, plus the completeness rules that ask whether an allergy status was documented at all."
  },
  {
    id: "dose-calculation",
    proposal:
      "Check local anesthetic and sedation doses against the patient's weight and flag anything over a safe limit.",
    conflict:
      "Two premises at once. It needs patient weight, which is patient data, and it requires the tool to compute a dose — refused explicitly and tested in dose-safety.test.ts and plausibility.test.ts. A tool that computes a dose correctly 999 times teaches a clinician to stop checking the thousandth, and the failure mode of that is a paediatric overdose.",
    instead:
      "The medication-safety rules already catch the arithmetic that CANNOT be right without computing what would be: pounds sitting beside a mg/kg calculation, a total that does not reconcile with the stated concentration, household spoon units, mixed unit systems. Every one is flag-only. The tool says 'these numbers do not agree'; the clinician says what the dose is."
  },
  {
    id: "ambient-dictation",
    proposal:
      "Let staff dictate the note, or record the operatory and transcribe it, with speech-to-text trained on dental terminology.",
    conflict:
      "A voice recording is biometric identifying data, and ambient capture in an operatory records the patient speaking — their voice, their name, their history, whatever else is said in the room. The PHI gate operates on text and runs before any model call; audio would route around it entirely, and the de-identification premise cannot survive that.",
    instead:
      "Shorthand expansion, standard-phrase chips, and one-click controlled vocabulary, which is where most of the typing goes. If dictation is ever wanted it belongs in the EDR at the point where identity is already legitimately present, not in the de-identified layer."
  },
  {
    id: "confidence-scores",
    proposal:
      "Have the AI attach a confidence score to each transformation and require review of the low-confidence ones.",
    conflict:
      "There is no probability to report. The deterministic pass is rules over tables — a rule either matched or it did not — so a percentage next to it would be decoration. And on the model path a score is actively worse than what is already there: '84% confident' invites a clinician at the end of a long day to accept it, which is precisely the judgement the number was supposed to protect.",
    instead:
      "A binary verifier that REFUSES. verifyMeaning either passes a draft to a human or rejects it and names the reason, and the deterministic pass separates every change into APPLIED (fixed, language-only) or FLAGGED (needs a clinical fact the tool does not have). A refusal does not negotiate, and it cannot be waved through by someone who is tired."
  }
] as const;
