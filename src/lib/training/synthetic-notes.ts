// SYNTHETIC TRAINING NOTES — one primary draft per persona agent.
//
// Fully de-identified. No real patient existed. Notes are written in the voice
// of persona-agents.ts and tagged with documentation-risk / Curve Hero / staff-complaint
// patterns from knowledge/sources/persona-training-corpus-research.md.
//
// expectedAuditRulePrefixes: prefixes that MUST fire under runTextAudit today.
// expectedDefectTags: semantic labels for coach/SuperByte/eval even when a
// deterministic rule does not yet exist for every nuance.
//
// These notes are for training and evaluation only. They must never be filed
// as production clinical records, and the transformer must not invent facts
// to "repair" them without clinician input.

import { PERSONA_AGENTS } from "./persona-agents";

export interface SyntheticTrainingNote {
  id: string;
  agentId: string;
  title: string;
  noteType: string;
  /** Defective draft in the persona's voice. */
  text: string;
  /** Research / claim-file pattern ids from the digest. */
  researchBasis: string[];
  /** Audit ruleId prefixes that must fire on `text` (honest self-test). */
  expectedAuditRulePrefixes: string[];
  /** Semantic defect tags for coaching and future eval harnesses. */
  expectedDefectTags: string[];
  /** Tokens a competent repair should still carry (anti-bounty-farm). */
  requiredEvidence: string[];
}

export const SYNTHETIC_TRAINING_NOTES: readonly SyntheticTrainingNote[] = [
  {
    id: "note.avery-quinn.fill-mod",
    agentId: "avery-quinn",
    title: "Gen Z assistant — template residue + anesthetic gap",
    noteType: "restorative",
    text:
      "pt here for #14 MOD comp. copied last fill note lol. local anesthetic administered. " +
      "4 BW taken. rubber dam. shade A2. Patient tolerated procedure well. RTC TBD.",
    researchBasis: [
      "insufficient-detail",
      "imaging-no-read",
      "curve-template-minimal",
      "staff-speed-complaint"
    ],
    expectedAuditRulePrefixes: [
      "complete.anesthetic-no-amount",
      "complete.imaging-no-interpretation",
      "vague.tolerated-well",
      "residue.tbd"
    ],
    expectedDefectTags: [
      "textisms",
      "copy-forward",
      "anesthetic-no-amount",
      "imaging-no-read",
      "placeholder-residue"
    ],
    requiredEvidence: ["tooth 14", "composite", "carpule", "bitewing"]
  },
  {
    id: "note.jordan-blake.hygiene-rush",
    agentId: "jordan-blake",
    title: "Hygienist rush — bitewings without a read",
    noteType: "hygiene",
    text:
      "Adult prophylaxis completed. 4 bitewing radiographs taken. Generalized mild plaque. " +
      "Oral hygiene instruction given. Patient tolerated procedure well. Recare 6 months.",
    researchBasis: ["imaging-no-read", "insufficient-detail", "staff-schedule-pressure"],
    expectedAuditRulePrefixes: [
      "complete.imaging-no-interpretation",
      "vague.tolerated-well"
    ],
    expectedDefectTags: [
      "imaging-no-read",
      "ohi-boilerplate",
      "rushed-hygiene",
      "vague-tolerated-well"
    ],
    requiredEvidence: ["prophylaxis", "bitewing", "findings", "probing"]
  },
  {
    id: "note.priya-nair.consent-theater",
    agentId: "priya-nair",
    title: "Associate — consent discussed, decision never charted",
    noteType: "prosthodontic",
    text:
      "Tooth 19 evaluated for full coverage crown after fractured cusp. Soft tissues appeared " +
      "pink with no erythema noted on visual exam. Risks and benefits were discussed for crown " +
      "versus onlay versus no treatment. Consent form is on file in the packet. " +
      "The preparation was completed and a provisional crown was seated. Occlusion was adjusted.",
    researchBasis: ["consent-half", "ai-fluent-filler", "form-vs-conversation"],
    expectedAuditRulePrefixes: ["complete.consent-no-decision"],
    expectedDefectTags: [
      "consent-half",
      "form-cited-as-conversation",
      "passive-voice",
      "soft-tissue-without-exam-anchor"
    ],
    requiredEvidence: ["tooth 19", "crown", "consented", "provisional"]
  },
  {
    id: "note.marcus-webb.phone-advice",
    agentId: "marcus-webb",
    title: "Office manager — clinical advice on a phone note",
    noteType: "correspondence",
    text:
      "Patient called about pain after yesterday's extraction. Told them it is probably fine " +
      "and to rinse with warm salt water and take whatever leftover pain pills they have at home. " +
      "Said if it still hurts next week we can look at it. Seemed like a difficult patient again.",
    researchBasis: ["record-mechanics", "role-boundary", "judgmental-language", "FOLLOWUP_MISSING"],
    expectedAuditRulePrefixes: ["complete.extraction-no-outcome", "complete.procedure-no-followup"],
    expectedDefectTags: [
      "role-boundary-clinical-advice",
      "no-escalation-to-dentist",
      "judgmental-language",
      "rx-advice-without-prescriber",
      "delayed-or-memory-phone-note",
      "FOLLOWUP_MISSING"
    ],
    requiredEvidence: ["extraction", "dentist", "post-operative"]
  },
  {
    id: "note.denise-ortiz.crown-template",
    agentId: "denise-ortiz",
    title: "Lead DA — Curve-style crown template minimal fill",
    noteType: "prosthodontic",
    text:
      "Crown prep #30. Same as last. Local anesthetic administered. Cord packed. Impression taken. " +
      "Temp cemented. Shade A3. Core buildup placed for the crown as needed. RTC for seat. [material] TBD.",
    researchBasis: [
      "no-rationale",
      "curve-template-minimal",
      "copy-forward",
      "insufficient-detail"
    ],
    expectedAuditRulePrefixes: [
      "complete.anesthetic-no-amount",
      "complete.clinical-rationale",
      "justify.buildup-retention",
      "justify.crown-necessity",
      "residue.square-brackets",
      "residue.tbd"
    ],
    expectedDefectTags: [
      "template-minimal-fill",
      "same-as-last",
      "crown-without-necessity",
      "buildup-without-retention-why",
      "placeholder-residue"
    ],
    requiredEvidence: ["tooth 30", "crown", "carpule", "buildup"]
  },
  {
    id: "note.helen-krause.endo-abbrev",
    agentId: "helen-krause",
    title: "Owner DDS — technique-rich, consent-thin endo shorthand",
    noteType: "endodontic",
    text:
      "#3 RCT cont. Dx irrev pulpitis. Access under RD. WL MB 19.5 DB 18.5 P 21. " +
      "Instrumentation to 30/04. NaOCl + EDTA. CaOH. Temp Cavit. Risks and benefits were " +
      "discussed for endodontic therapy versus no treatment. RTC obturation.",
    researchBasis: ["consent-half", "abbreviation-standardization", "insufficient-detail"],
    expectedAuditRulePrefixes: ["complete.consent-no-decision"],
    expectedDefectTags: [
      "dense-private-abbreviations",
      "consent-half",
      "anesthetic-omitted",
      "technique-without-shared-key"
    ],
    requiredEvidence: ["tooth 3", "root canal", "consented", "lidocaine"]
  },
  {
    id: "note.ray-thompson.rct-sparse",
    agentId: "ray-thompson",
    title: "Near-retirement — MedPro-class sparse RCT entry",
    noteType: "endodontic",
    text: "RCT complete #30 with local. Patient tolerated well. No complications. Next visit if needed.",
    researchBasis: [
      "sparse-operative",
      "medpro-rct-with-local",
      "insufficient-detail",
      "near-retirement-brevity",
      "AMBIGUOUS_NEGATIVE"
    ],
    expectedAuditRulePrefixes: ["vague.tolerated-well", "vague.no-complications", "complete.clinical-rationale"],
    expectedDefectTags: [
      "sparse-operative",
      "anesthetic-as-with-local",
      "no-findings",
      "no-technique",
      "no-consent",
      "no-materials",
      "AMBIGUOUS_NEGATIVE"
    ],
    requiredEvidence: ["tooth 30", "root canal", "carpule", "radiograph"]
  },
  {
    id: "note.shirley-grant.triage",
    agentId: "shirley-grant",
    title: "Front desk — judgmental triage without dentist escalation",
    noteType: "correspondence",
    text:
      "Called about swelling after cleaning. Noncompliant with flossing as usual. Told them to " +
      "use Orajel and come in if they feel like it. Charted late because the desk was slammed.",
    researchBasis: ["record-mechanics", "judgmental-language", "role-boundary"],
    expectedAuditRulePrefixes: ["vague.noncompliant"],
    expectedDefectTags: [
      "judgmental-language",
      "front-desk-clinical-advice",
      "no-escalation-to-dentist",
      "delayed-entry",
      "stigmatizing-noncompliant"
    ],
    requiredEvidence: ["swelling", "dentist", "same-day"]
  },
  {
    id: "note.sam-okonkwo.pedo-dose",
    agentId: "sam-okonkwo",
    title: "New grad — defensive fluff + lb with mg/kg",
    noteType: "pediatric",
    text:
      "Pediatric restorative visit. Soft tissue pink and healthy throughout, no lesions anywhere " +
      "in the mouth on brief glance. Weight 44 lb. Midazolam dosed at 0.5 mg/kg oral. Gave one " +
      "teaspoon of suspension. #J occlusal composite placed. Occlusion checked. Parent reassured " +
      "extensively about every possible risk though not all were procedure-specific.",
    researchBasis: ["rx-incomplete", "pediatric-dosing", "defensive-over-charting"],
    expectedAuditRulePrefixes: [
      "medsafe.lb-with-mg-per-kg",
      "medsafe.household-units"
    ],
    expectedDefectTags: [
      "pediatric-lb-mg-per-kg",
      "household-spoon",
      "defensive-over-charting",
      "soft-detail-without-source",
      "consent-unfocused"
    ],
    requiredEvidence: ["kg", "midazolam", "mL", "tooth"]
  },
  {
    id: "note.pat-ellis.supervision",
    agentId: "pat-ellis",
    title: "Emeritus — new-patient visit with thin supervision narrative",
    noteType: "diagnostic",
    text:
      "New patient exam completed with assistant. Comprehensive evaluation. Treatment options " +
      "discussed. Radiographs taken. Hygiene to proceed with scaling as needed. Supervising " +
      "dentist available. Patient will return for restorative.",
    researchBasis: [
      "insufficient-detail",
      "supervision-gap",
      "imaging-no-read",
      "consent-half"
    ],
    expectedAuditRulePrefixes: [
      "complete.imaging-no-interpretation",
      "complete.consent-no-decision"
    ],
    expectedDefectTags: [
      "supervision-undocumented",
      "new-patient-delegation-gap",
      "imaging-no-read",
      "consent-half",
      "tele-or-remote-presence-unclear"
    ],
    requiredEvidence: ["new patient", "dentist", "findings", "consented"]
  }
] as const;

export const SYNTHETIC_NOTE_BY_ID: ReadonlyMap<string, SyntheticTrainingNote> = new Map(
  SYNTHETIC_TRAINING_NOTES.map((n) => [n.id, n])
);

/** Every persona must author exactly one primary note in the frozen corpus. */
export function notesCoverAllPersonas(
  notes: readonly SyntheticTrainingNote[] = SYNTHETIC_TRAINING_NOTES,
  agents = PERSONA_AGENTS
): boolean {
  const covered = new Set(notes.map((n) => n.agentId));
  return agents.every((a) => covered.has(a.id)) && notes.length === agents.length;
}
