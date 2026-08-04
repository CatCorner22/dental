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
  },

  // ------------------------------------------------------------------------
  // OWNER-AUTHORED ENCOUNTER TEMPLATES, adapted 2026-08-04.
  //
  // The owner supplied these as full note scaffolds (see
  // knowledge/sources/tn-des12-legal-blueprint.md for the framework they come
  // from). Three adaptations were made on purpose, and each would be a bug to
  // "fix" back:
  //
  //  - NO DATE LINES IN THE BODY. This app's PHI rule hard-blocks exact dates
  //    in draft text — dates belong in the EDR — and Curve supplies the date of
  //    service by pasting the note under the dated visit. The original
  //    templates open with "DATE OF SERVICE:"; here that fact is carried by the
  //    paste-under-the-correct-visit attestation instead, which is also what
  //    the two-identifier copy confirmation enforces.
  //  - ATTRIBUTION AS PLACEHOLDERS. Who performed, who reviewed, who taught —
  //    every one is an angle-bracket slot, so the residue rule blocks filing
  //    until a person is named. A template that pre-fills attribution is a
  //    template that attests for you.
  //  - NO PRE-ATTESTED FINDINGS. Lines like "Complications:" carry a
  //    placeholder that demands an affirmative statement or the specific
  //    event. The composer never prints "None" uninvited anywhere in this app,
  //    and these templates keep that promise inside pasted text too.
  // ------------------------------------------------------------------------
  {
    id: "operative-with-assistant",
    title: "Operative visit (dentist + assistant)",
    purpose: "The full operative scaffold with role attribution kept separate throughout.",
    body:
      "ASSISTANT: <assistant name and credential>\n" +
      "TREATING DENTIST: <treating dentist>\n" +
      "SUPERVISION: <direct - dentist on premises, or not applicable - dentist provided care>\n\n" +
      "REASON / SCHEDULED PROCEDURE:\n<reason for the visit, de-identified>\n\n" +
      "PREOPERATIVE REVIEW:\n" +
      "Medical history reviewed at this visit: <changes, or that the patient reported none>\n" +
      "Current medications: <medications as reported>\n" +
      "Allergies: <allergy status as verified with the patient>\n" +
      "Vital signs: <values, or the reason not taken>\n" +
      "Premedication or clearance: <status>\n" +
      "Patient concerns: <concerns, or that the patient raised none>\n\n" +
      "DENTIST DIAGNOSIS / PLAN:\n<diagnosis and plan as stated by the dentist>\n\n" +
      "CONSENT:\nDiscussion conducted by: <clinician who led the consent discussion>\n" +
      "Patient decision: <decision in the patient's words>\n" +
      "Questions asked: <questions, or that the patient asked none>\n\n" +
      "PROCEDURE:\nTooth/site/surface: <tooth, site, and surfaces>\n" +
      "Anesthetic administered by: <administrator>\n" +
      "Agent/concentration/amount: <agent, concentration, and carpules or milligrams>\n" +
      "Isolation/protection: <isolation used>\n" +
      "Assistant-performed delegated functions: <functions the assistant personally performed>\n" +
      "Materials/shade/lot when pertinent: <materials>\n" +
      "Dentist-performed treatment: <steps the dentist performed>\n" +
      "Deviations from planned care: <affirmatively state none occurred, or the specifics>\n\n" +
      "OUTCOME:\nContacts/occlusion/hemostasis/status: <as applicable>\n" +
      "Patient response: <observed response>\n" +
      "Complications: <affirmatively state none were observed, or the specific event>\n" +
      "Corrective action: <action taken, or that none was required>\n\n" +
      "INSTRUCTIONS:\nProvided by: <who instructed>\n" +
      "Written or electronic material: <material provided>\n" +
      "Warning signs reviewed: <signs stated to the patient>\n" +
      "Teach-back result: <what the patient explained back>\n\n" +
      "PLAN:\nNext visit and timeframe: <next step and interval>\n" +
      "Pending or referral items: <items, or that none remain>\n\n" +
      "AUTHENTICATION:\nEntered by: <author and role>\n" +
      "Assistant-performed services: <assistant>\n" +
      "Dentist-performed services: <dentist>\n" +
      "Reviewed and confirmed by dentist: <reviewing dentist>",
    verify: [
      "I will paste this under the correct dated visit in Curve, which supplies the date of service.",
      "Every attribution line will name the person who actually performed or reviewed that part.",
      "The complication line will state an affirmative observation, never a default."
    ]
  },
  {
    id: "hygiene-composite",
    title: "Hygiene visit (hygienist + dentist)",
    purpose: "The composite hygiene scaffold: hygienist findings and dentist judgement kept visibly separate.",
    body:
      "HYGIENIST: <hygienist name and credential>\n" +
      "DENTIST: <dentist>\n" +
      "PATIENT STATUS: <new patient or established patient>\n" +
      "SUPERVISION: <direct - dentist on premises, or general - authorized in advance>\n\n" +
      "REASON / PATIENT GOAL:\n<the patient's stated reason and goal, de-identified>\n\n" +
      "HEALTH REVIEW:\nHistory reviewed at this visit: <changes, or that the patient reported none>\n" +
      "Current medications: <medications as reported>\n" +
      "Allergies: <allergy status as verified with the patient>\n" +
      "Vital signs: <values, or the reason not taken>\n" +
      "Relevant precautions: <precautions, or that none apply>\n\n" +
      "SUBJECTIVE:\n<pain, sensitivity, bleeding, dry mouth, or home-care concerns the patient reports>\n\n" +
      "HYGIENE AND PERIODONTAL FINDINGS:\nPlaque: <findings>\n" +
      "Calculus: <findings>\nBleeding: <findings>\nProbing: <depths and sites>\n" +
      "Recession: <findings>\nMobility/furcation: <findings>\n" +
      "Gingival findings: <findings>\nPeriodontal risk or status: <assessment>\n" +
      "Oral cancer screening: <what was examined and observed>\n" +
      "Other hard- or soft-tissue findings: <findings, or affirmatively none observed>\n" +
      "Caries-risk observations: <observations>\n\n" +
      "IMAGING:\nImages acquired: <number and type, or none this visit>\n" +
      "Indication: <patient-specific reason>\n" +
      "DENTIST RADIOGRAPHIC INTERPRETATION: <findings as stated by the dentist, or pending with owner>\n\n" +
      "HYGIENE SERVICES:\n<prophylaxis, scaling and root planing, or periodontal maintenance>\n" +
      "Areas treated: <areas>\nInstrumentation: <instruments and agents>\n" +
      "Local anesthesia or nitrous oxide, if used: <details, or state not used>\n" +
      "Fluoride/desensitizer/sealants: <details, or state not provided>\n\n" +
      "PATIENT-SPECIFIC EDUCATION:\nObserved home-care need: <what was observed>\n" +
      "Instruction or demonstration: <what was taught>\n" +
      "Products or aids discussed: <aids>\n" +
      "Teach-back result: <what the patient explained back>\n\n" +
      "DENTIST EXAMINATION / DIAGNOSIS:\n<dentist's own entry - never completed by the hygienist>\n\n" +
      "DENTIST RECOMMENDATIONS / CONSENT:\n<dentist's recommendation and the patient's decision>\n\n" +
      "PLAN:\nRecall or periodontal-maintenance interval: <interval and reason>\n" +
      "Recommended treatment: <treatment>\nReferral: <referral, or that none was made>\n" +
      "Pending items: <items, or that none remain>\n\n" +
      "AUTHENTICATION:\nHygiene services performed and documented by: <hygienist>\n" +
      "Dentist examination performed by: <dentist>\n" +
      "Dentist review completed: <reviewing dentist>",
    verify: [
      "I will paste this under the correct dated visit in Curve, which supplies the date of service.",
      "The dentist-labelled sections will contain the dentist's own words, not my summary of them.",
      "From January 1, 2027, a new patient's hygiene services here happened under direct supervision."
    ]
  },
  {
    id: "patient-visit-summary",
    title: "Patient-readable visit summary",
    purpose: "Plain language for the patient, prepared from the finished note — supplemental, never a substitute for the record.",
    body:
      "YOUR DENTAL VISIT\n\n" +
      "WHY YOU CAME\n<the reason, in plain words>\n\n" +
      "WHAT WE CHECKED\n<what was examined and any pictures taken, in plain words>\n\n" +
      "WHAT WE FOUND\n<findings in plain words - keep possible as possible, never upgrade to certain>\n" +
      "<each tooth number with its everyday location, like tooth 30, the lower-right first molar>\n\n" +
      "WHAT WE ARE STILL WATCHING OR NEED TO CONFIRM\n<anything uncertain or pending>\n\n" +
      "WHAT WE DID TODAY\n<treatment in plain words>\n\n" +
      "WHAT TO EXPECT\n<expected symptoms and how long>\n\n" +
      "WHAT TO DO AT HOME\n1. <action>\n2. <action>\n3. <action>\n\n" +
      "CALL US PROMPTLY IF\n- <warning sign>\n- <warning sign>\n- <warning sign>\n\n" +
      "YOUR NEXT STEP\n<next visit or referral and timeframe>\n\n" +
      "QUESTIONS\n<how to reach the practice>\n\n" +
      "This plain-language summary was prepared from the finalized clinical record for this " +
      "visit. It is intended to help explain the visit. It does not replace the complete " +
      "official dental record.",
    verify: [
      "The clinical note this summarizes is finalized — the summary is being made from it, not before it.",
      "Every statement here also appears in the clinical note; nothing is added, and no possible became definite.",
      "The closing line stays: this supplements the record and never replaces the patient's right to it."
    ]
  },
  {
    id: "addendum",
    title: "Addendum to a finalized note",
    purpose: "The correction path that never touches the original: dated, attributed, and never backdated.",
    body:
      "ADDENDUM\n" +
      "This addendum is entered under the original visit in Curve; the original date of " +
      "service is that visit's date.\n" +
      "AUTHOR / ROLE: <author and role>\n\n" +
      "REASON FOR ADDENDUM:\n<why this addendum is needed>\n\n" +
      "ADDITIONAL OR CORRECTED INFORMATION:\n<the information, stated fully rather than by reference>\n\n" +
      "The original entry remains unchanged. This addendum was entered on the date and time " +
      "shown by the entry itself and was not backdated.\n\n" +
      "REVIEWED BY: <reviewing clinician>",
    verify: [
      "The original note stays locked and untouched — this adds to the record, it does not rewrite it.",
      "This entry is being made now, under today's entry timestamp, with no backdating of any kind.",
      "I will attach this under the SAME visit as the original note in Curve."
    ]
  }
];

export const BLOCK_BY_ID: ReadonlyMap<string, VerifiedBlock> = new Map(
  VERIFIED_BLOCKS.map((b) => [b.id, b])
);
