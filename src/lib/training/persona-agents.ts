// TEN PERSONA AGENTS for synthetic training notes.
//
// Each agent is a frozen, de-identified staff archetype: age, IQ band, openness,
// career stage, and the failure modes that career-point / generational research
// predicts. Agents do not represent real people. They exist so training notes
// and adversarial evals stay tied to how different staff actually break charts
// under schedule pressure — not to tidy textbook SOAP.
//
// Research grounding: knowledge/sources/persona-training-corpus-research.md
// (MedPro sparse-operative cases, The Doctors Company documentation factors,
// Curve Hero template culture, staff-forum complaint themes).
//
// Openness is 0–100 (low = resists coaching / reasserts sparse habits;
// high = accepts tools quickly, may over-correct into fluent filler).

export type CareerStage =
  | "new-hire"
  | "early-career"
  | "mid-career"
  | "senior"
  | "near-retirement"
  | "emeritus";

export type GenerationBand =
  | "gen-z"
  | "millennial"
  | "gen-x"
  | "boomer"
  | "silent-adjacent";

export interface PersonaAgent {
  id: string;
  displayName: string;
  /** Integer age years; corpus spans 22–85. */
  age: number;
  /** Approximate IQ band used only for training diversity; not a clinical claim. */
  iq: number;
  /** 0–100 receptivity to coaching, templates, and new tooling. */
  openness: number;
  generation: GenerationBand;
  careerStage: CareerStage;
  role: string;
  /** One-paragraph voice / attitude for authors writing their notes. */
  personality: string;
  /** How openness shows up when Smile Notes or Curve required fields push back. */
  coachingResponse: string;
  /** Recurring complaints this persona would post on a staff message board. */
  commonComplaints: string[];
  /** Charting failure modes this persona reliably produces. */
  failureModes: string[];
  /** Documentation-risk pattern tags from claim-file research (see litigation-documentation-research.md). */
  documentationRiskPatterns: string[];
}

export const PERSONA_AGENTS: readonly PersonaAgent[] = [
  {
    id: "avery-quinn",
    displayName: "Avery Quinn",
    age: 22,
    iq: 118,
    openness: 88,
    generation: "gen-z",
    careerStage: "new-hire",
    role: "Registered dental assistant",
    personality:
      "Fast typist, phone-native shorthand, wants to finish charting before the next patient " +
      "is seated. Friendly and coachable, but treats required fields as a game to clear.",
    coachingResponse:
      "Accepts templates and AI drafts immediately; may paste fluent text without verifying amounts.",
    commonComplaints: [
      "Charting takes longer than the appointment",
      "Too many clicks between odontogram and notes",
      "Why can't I just Autocorrect the template"
    ],
    failureModes: [
      "textisms-and-nonstandard-shorthand",
      "copy-forward-template",
      "anesthetic-named-without-amount",
      "placeholder-residue"
    ],
    documentationRiskPatterns: ["insufficient-detail", "imaging-no-read", "sparse-operative"]
  },
  {
    id: "jordan-blake",
    displayName: "Jordan Blake",
    age: 28,
    iq: 105,
    openness: 72,
    generation: "millennial",
    careerStage: "early-career",
    role: "Registered dental hygienist",
    personality:
      "Schedule-driven hygienist who values patient rapport over documentation craft. " +
      "Writes the note in the last three minutes of the visit or after the next patient is seated.",
    coachingResponse:
      "Open to checklists if they save clicks; resists rewriting a note that already 'feels done.'",
    commonComplaints: [
      "Cloud lag when probing and charting at once",
      "Insurance wants a novel for a prophy",
      "I already clicked the bitewings in imaging"
    ],
    failureModes: [
      "imaging-without-interpretation",
      "ohi-boilerplate",
      "rushed-perio-without-numbers",
      "vague-tolerated-well"
    ],
    documentationRiskPatterns: ["imaging-no-read", "insufficient-detail", "no-rationale"]
  },
  {
    id: "priya-nair",
    displayName: "Priya Nair",
    age: 34,
    iq: 132,
    openness: 91,
    generation: "millennial",
    careerStage: "early-career",
    role: "Associate dentist",
    personality:
      "Highly verbal, early adopter of ambient / AI note tools. Writes long fluent notes that " +
      "sound complete and still miss the decision and the numbers a deposition needs.",
    coachingResponse:
      "Enthusiastically adopts coaching; over-corrects into soft-tissue filler and passive voice.",
    commonComplaints: [
      "AI draft is almost right — why make me retype amounts",
      "Consent form already signed in the packet",
      "Templates feel dumbed down for associates"
    ],
    failureModes: [
      "consent-discussion-without-decision",
      "ai-flavored-soft-tissue-invention-risk",
      "passive-voice-operative",
      "form-cited-as-conversation"
    ],
    documentationRiskPatterns: ["consent-half", "insufficient-detail", "record-mechanics"]
  },
  {
    id: "marcus-webb",
    displayName: "Marcus Webb",
    age: 41,
    iq: 98,
    openness: 55,
    generation: "gen-x",
    careerStage: "mid-career",
    role: "Office manager",
    personality:
      "Owns the schedule and the inbox. Steps into clinical charting when providers are behind, " +
      "using managerial tone and second-hand clinical advice.",
    coachingResponse:
      "Will change process if ownership mandates it; argues that front-desk notes are 'just communication.'",
    commonComplaints: [
      "Providers leave notes unfinished at checkout",
      "Patients call and someone has to answer something",
      "Too many systems for one front desk"
    ],
    failureModes: [
      "role-boundary-clinical-advice",
      "delayed-entry-from-memory",
      "wrong-visit-attachment-language",
      "judgmental-administrative-tone"
    ],
    documentationRiskPatterns: ["record-mechanics", "insufficient-detail"]
  },
  {
    id: "denise-ortiz",
    displayName: "Denise Ortiz",
    age: 48,
    iq: 110,
    openness: 42,
    generation: "gen-x",
    careerStage: "mid-career",
    role: "Lead dental assistant",
    personality:
      "Knows every Curve Forms template by heart. Pride is speed and a clean checkout queue. " +
      "Minimal fills that satisfy required fields; 'same as last' is a feature, not a bug.",
    coachingResponse:
      "Defends templates as practice standard; changes only when a required field blocks save.",
    commonComplaints: [
      "New software wants essays",
      "Same procedure every time — why retype",
      "Doctors change the plan after I already charted"
    ],
    failureModes: [
      "template-minimal-fill",
      "copy-forward-same-as-last",
      "crown-without-necessity-narrative",
      "residue-tbd-fields"
    ],
    documentationRiskPatterns: ["no-rationale", "insufficient-detail", "sparse-operative"]
  },
  {
    id: "helen-krause",
    displayName: "Dr. Helen Krause",
    age: 55,
    iq: 140,
    openness: 78,
    generation: "gen-x",
    careerStage: "senior",
    role: "Owner dentist",
    personality:
      "Clinically meticulous, paper-trained, still thinks in private abbreviation systems. " +
      "Content is often defensibly rich; surface form fails practice standardization.",
    coachingResponse:
      "Open to evidence-based standards; irritated by tools that expand safe abbreviations she trusts.",
    commonComplaints: [
      "Shared abbreviation list is incomplete for endo",
      "I already wrote everything that matters",
      "Young staff expand things into mush"
    ],
    failureModes: [
      "dense-private-abbreviations",
      "nonstandard-shorthand-gate",
      "technique-rich-consent-thin",
      "paper-era-structure"
    ],
    documentationRiskPatterns: ["consent-half", "insufficient-detail"]
  },
  {
    id: "ray-thompson",
    displayName: "Dr. Ray Thompson",
    age: 62,
    iq: 92,
    openness: 28,
    generation: "boomer",
    careerStage: "near-retirement",
    role: "General dentist",
    personality:
      "Decades of uneventful charts. Believes brevity signals competence. The MedPro sparse " +
      "operative pattern in human form — resists being told the note must reconstruct the visit.",
    coachingResponse:
      "Low openness: reasserts 'the note is fine' and trims coaching suggestions back to stubs.",
    commonComplaints: [
      "Nobody sued me for short notes before computers",
      "Templates slow me down",
      "I remember the case — the chart is a reminder"
    ],
    failureModes: [
      "sparse-operative-classic",
      "anesthetic-as-with-local",
      "no-findings-no-technique",
      "resists-required-detail"
    ],
    documentationRiskPatterns: ["sparse-operative", "imaging-no-read", "consent-half", "insufficient-detail"]
  },
  {
    id: "shirley-grant",
    displayName: "Shirley Grant",
    age: 71,
    iq: 85,
    openness: 22,
    generation: "boomer",
    careerStage: "near-retirement",
    role: "Front desk coordinator",
    personality:
      "Longest-tenured employee. Handles phone triage with confident plain speech that sometimes " +
      "becomes clinical advice in the record. Dislikes being corrected on tone.",
    coachingResponse:
      "Very low openness: treats documentation coaching as criticism of loyalty and experience.",
    commonComplaints: [
      "I have been doing this since before Sidekick",
      "Patients want an answer now",
      "Doctors never call back and someone has to say something"
    ],
    failureModes: [
      "front-desk-clinical-advice",
      "judgmental-language",
      "delayed-phone-note",
      "missing-escalation-to-dentist"
    ],
    documentationRiskPatterns: ["record-mechanics", "insufficient-detail"]
  },
  {
    id: "sam-okonkwo",
    displayName: "Dr. Sam Okonkwo",
    age: 25,
    iq: 125,
    openness: 65,
    generation: "gen-z",
    careerStage: "new-hire",
    role: "New graduate dentist",
    personality:
      "Malpractice-anxious new graduate. Over-documents defensively, sometimes inventing soft " +
      "detail 'because the template had a field,' while still dropping laterality or dose units.",
    coachingResponse:
      "Moderately open: wants a perfect defensive note; confuses length with defensibility.",
    commonComplaints: [
      "School said document everything but the schedule is impossible",
      "Which abbreviations are safe here",
      "Pedo dosing math under time pressure"
    ],
    failureModes: [
      "defensive-over-charting",
      "soft-detail-without-source",
      "pediatric-lb-with-mg-per-kg",
      "laterality-ambiguity"
    ],
    documentationRiskPatterns: ["rx-incomplete", "insufficient-detail", "record-mechanics"]
  },
  {
    id: "pat-ellis",
    displayName: "Dr. Pat Ellis",
    age: 85,
    iq: 100,
    openness: 48,
    generation: "silent-adjacent",
    careerStage: "emeritus",
    role: "Part-time emeritus consultant / supervising dentist",
    personality:
      "Returns one day a week for new-patient exams and remote consults. Kind, deliberate, " +
      "and thin on documenting who was physically present and what was supervised.",
    coachingResponse:
      "Will update when shown a statute or Board rule; otherwise keeps legacy phrasing.",
    commonComplaints: [
      "Supervision rules keep changing",
      "Tele-dentistry notes feel like paperwork about paperwork",
      "I already examined the patient — the assistant charted"
    ],
    failureModes: [
      "supervision-undocumented",
      "tele-dentistry-thin",
      "new-patient-delegation-gap",
      "outdated-terminology"
    ],
    documentationRiskPatterns: ["insufficient-detail", "record-mechanics", "consent-half"]
  }
] as const;

export const PERSONA_BY_ID: ReadonlyMap<string, PersonaAgent> = new Map(
  PERSONA_AGENTS.map((a) => [a.id, a])
);

/** Corpus contract: ten agents spanning the requested IQ / age / openness ranges. */
export function assertPersonaCorpusShape(agents: readonly PersonaAgent[] = PERSONA_AGENTS): void {
  if (agents.length !== 10) {
    throw new Error(`expected 10 persona agents, got ${agents.length}`);
  }
  const ages = agents.map((a) => a.age);
  const iqs = agents.map((a) => a.iq);
  const openness = agents.map((a) => a.openness);
  if (Math.min(...ages) > 22 || Math.max(...ages) < 85) {
    throw new Error("persona ages must span 22 through 85");
  }
  if (Math.min(...iqs) > 85 || Math.max(...iqs) < 140) {
    throw new Error("persona IQ values must span 85 through 140");
  }
  if (Math.min(...openness) > 25 || Math.max(...openness) < 85) {
    throw new Error("persona openness must include low and high ends of the spectrum");
  }
}
