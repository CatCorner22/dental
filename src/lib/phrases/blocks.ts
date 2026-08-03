// Verified phrase blocks: the "pre-loaded" text that saves typing WITHOUT
// becoming the cloned template language the ADA warns about.
//
// The design against lazy clicking, in three locks:
//
//  1. EVERY CHECKBOX IS AN ASSERTION. The user does not tick "insert" — they
//     tick "the consent conversation happened and I was there for it". Each
//     box states the fact the block will put in the record, so ticking it IS
//     the attestation, and skipping the reading means asserting blind, which
//     is the same act with the same name on it.
//  2. EVERY BLOCK CARRIES PLACEHOLDERS. The angle-bracket slots (<tooth>,
//     <material>, <response>) are the parts that make the entry THIS
//     patient's entry. The existing template-residue audit rule stops the
//     note at S0/S1 while any placeholder survives — so a block can never be
//     inserted and filed untouched. The rails do the enforcement; the block
//     just makes the right thing fast.
//  3. NOTHING IS PRE-CHECKED. Defaults assert nothing.

export interface VerifiedBlock {
  id: string;
  title: string;
  /** What this block is for, one line, shown in the picker. */
  purpose: string;
  /** The text inserted. Placeholders in <angle brackets> must be replaced. */
  body: string;
  /**
   * The assertions the user must individually confirm before insertion.
   * Each one is a fact that will be in the record with the author's name.
   */
  verify: string[];
}

export const VERIFIED_BLOCKS: VerifiedBlock[] = [
  {
    id: "consent-conversation",
    title: "Consent conversation",
    purpose: "Documents the discussion, not just a signature — the gap that loses cases.",
    body:
      "Discussed the diagnosis of <diagnosis as stated by the dentist>, the proposed treatment " +
      "of <procedure> on <tooth/site>, material risks including <risks discussed>, expected " +
      "benefits, alternatives including <alternatives discussed>, and the option of no " +
      "treatment. The patient asked <questions asked, or state none> and chose to " +
      "<decision>. Consent was recorded before treatment began.",
    verify: [
      "This conversation actually happened at this visit, before treatment began.",
      "The risks and alternatives I will fill in are the ones actually discussed, not a standard list.",
      "The decision I will record is the patient's own stated decision."
    ]
  },
  {
    id: "no-complications",
    title: "No complications observed",
    purpose: "An affirmative statement bounded to what was actually observed.",
    body:
      "No complication was observed during the procedure or the recorded recovery period. " +
      "The patient's condition at departure: <condition at departure>.",
    verify: [
      "I observed the recovery period I am describing — this is not an assumption.",
      "No complication occurred that this statement would contradict."
    ]
  },
  {
    id: "postop-instructions",
    title: "Post-operative instructions",
    purpose: "Instructions given, understood, and in the patient's hands.",
    body:
      "Post-operative instructions for <procedure> were reviewed with the patient verbally and " +
      "provided in writing, covering <key instructions>. The patient confirmed understanding " +
      "and was advised to contact the office for <return precautions>.",
    verify: [
      "The instructions were actually reviewed at this visit, verbally and in writing.",
      "The return precautions I will fill in were specifically stated to the patient."
    ]
  },
  {
    id: "medical-history-reviewed",
    title: "Medical history reviewed",
    purpose: "The safety block: history, allergies, and medications, with a real status each.",
    body:
      "Medical history reviewed and updated at this visit. Allergies: <allergy status as " +
      "verified with the patient>. Current medications: <medications as reported>. Changes " +
      "since last visit: <changes, or state that the patient reported none>.",
    verify: [
      "I asked at THIS visit — this is not carried forward from the chart unchecked.",
      "The allergy status I will record is what the patient verified, in their words."
    ]
  },
  {
    id: "local-anesthetic",
    title: "Local anesthetic record",
    purpose: "Agent, concentration, vasoconstrictor, amount, site, and response — complete or absent.",
    body:
      "Local anesthesia: <agent and concentration> with <vasoconstrictor and ratio, or state " +
      "none>, <number> carpule(s), administered via <technique/site>. Patient response: " +
      "<observed response>.",
    verify: [
      "The agent, amount, and site I will fill in are from this visit's actual administration.",
      "The response I will describe was observed, not assumed."
    ]
  },
  {
    id: "radiograph-interpretation",
    title: "Radiograph taken and interpreted",
    purpose: "An image without an interpretation is a liability, not a record.",
    body:
      "<Number and type> radiograph(s) acquired of <site>. Indication: <patient-specific " +
      "reason>. Interpretation by <interpreting dentist>: <findings as stated by the dentist>.",
    verify: [
      "A dentist actually interpreted this image — I am recording their stated findings, not mine.",
      "The indication I will fill in is this patient's specific reason, not a routine default."
    ]
  },
  {
    id: "referral",
    title: "Referral made",
    purpose: "Who, to whom, for what, and what the patient was told.",
    body:
      "Referred the patient to <specialist/practice> for <reason as stated by the dentist>. " +
      "The patient was informed of the reason and the timeframe: <what the patient was told>. " +
      "Records to be forwarded: <records>.",
    verify: [
      "The referral was actually made or handed to the patient at this visit.",
      "The reason I will record is the dentist's stated reason."
    ]
  }
];

export const BLOCK_BY_ID: ReadonlyMap<string, VerifiedBlock> = new Map(
  VERIFIED_BLOCKS.map((b) => [b.id, b])
);
