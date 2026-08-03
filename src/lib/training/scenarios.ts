// The Training Arena: practice cases with PLANTED defects.
//
// Each scenario is a realistic, fully synthetic note whose defects are the
// exact ones the audit engine catches in real work — so practicing here and
// charting for real are the same skill, and a scenario can be verified
// SERVER-SIDE by running the same audit that gates real notes. No patient
// existed; no note files; nothing leaves the training page.
//
// The bounty is double the A-band award (2 × 150): the system pays extra for
// the practice run it asked for, once per scenario per person — the ledger's
// unique index enforces the "once".

export interface TrainingScenario {
  id: string;
  title: string;
  blurb: string;
  /** The GPA axis this scenario trains — the supportive band deep-links by it. */
  axis: "completeness" | "specificity" | "consistency" | "justification";
  /** The defective draft the trainee must repair. */
  text: string;
  /** Rule-id prefixes that MUST fire on the defective text (self-test + honest marketing). */
  plantedRules: string[];
  /**
   * Case-specific tokens the repaired text must still carry. Without these,
   * any clean unrelated note would clear the generic audit and farm the bounty.
   */
  requiredEvidence: string[];
  bounty: number;
}

export const TRAINING_BOUNTY = 300;

export const TRAINING_SCENARIOS: TrainingScenario[] = [
  {
    id: "root-canal-challenge",
    title: "The Root Canal Challenge",
    axis: "specificity",
    blurb:
      "An endodontic note that reads fine at a glance and answers none of the questions a later reader asks. Make it specific.",
    text:
      "Root canal therapy started on tooth 19 today. Patient tolerated well. " +
      "Local anesthetic administered. Radiographs taken. " +
      "Will complete at the next visit.",
    plantedRules: ["vague.", "complete.anesthetic-no-amount", "complete.imaging-no-interpretation"],
    requiredEvidence: ["tooth 19", "root canal", "carpule"],
    bounty: TRAINING_BOUNTY
  },
  {
    id: "srp-justification",
    title: "The Perio Narrative",
    axis: "justification",
    blurb:
      "Scaling and root planing that a claim reviewer would deny as written — the charting exists, the narrative never points at it.",
    text:
      "Scaling and root planing completed, upper right and lower right quadrants. " +
      "Patient given oral hygiene instruction and dismissed in good condition.",
    plantedRules: ["justify.srp-periodontal-evidence"],
    requiredEvidence: ["scaling", "root planing", "probing", "mm"],
    bounty: TRAINING_BOUNTY
  },
  {
    id: "sedation-numbers",
    title: "The Numbers That Cannot Agree",
    axis: "consistency",
    blurb:
      "A pediatric sedation note whose weights and doses contradict each other — the exact error family the kilogram rule exists for.",
    text:
      "Pediatric patient, weight 44 lb. Midazolam dosed at 0.5 mg/kg for the procedure. " +
      "Gave one teaspoon of oral suspension pre-operatively. " +
      "Procedure completed and patient dismissed with parent.",
    plantedRules: ["medsafe.lb-with-mg-per-kg", "medsafe.household-units"],
    requiredEvidence: ["midazolam", "kg", "ml"],
    bounty: TRAINING_BOUNTY
  }
];

export const SCENARIO_BY_ID: ReadonlyMap<string, TrainingScenario> = new Map(
  TRAINING_SCENARIOS.map((s) => [s.id, s])
);

/** A scenario is complete when the repaired text carries no blocking findings. */
export function isScenarioComplete(findings: { severity: string }[]): boolean {
  return !findings.some((f) => f.severity === "S0" || f.severity === "S1" || f.severity === "S2");
}

/**
 * Does the repaired text still look like THIS scenario — not an unrelated
 * clean note pasted in for bounty farming?
 */
export function matchesScenarioEvidence(scenario: TrainingScenario, text: string): boolean {
  const hay = text.toLowerCase();
  return scenario.requiredEvidence.every((token) => hay.includes(token.toLowerCase()));
}
