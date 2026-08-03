import { describe, expect, it } from "vitest";
import { runTextAudit } from "@/lib/audit/engine";
import { isScenarioComplete, matchesScenarioEvidence, TRAINING_SCENARIOS } from "./scenarios";

// The arena's honesty tests: every scenario must actually contain the
// defects it advertises, and a competent repair must actually clear it.
// A practice case that cannot be completed teaches people the tool lies.

describe("training scenarios", () => {
  it("every scenario's planted defects actually fire", () => {
    for (const scenario of TRAINING_SCENARIOS) {
      const findings = runTextAudit(scenario.text);
      for (const prefix of scenario.plantedRules) {
        expect(
          findings.some((f) => f.ruleId.startsWith(prefix)),
          `${scenario.id} promises ${prefix} but the audit does not raise it`
        ).toBe(true);
      }
      expect(isScenarioComplete(findings), `${scenario.id} must start incomplete`).toBe(false);
    }
  });

  it("the root canal case clears with a specific repair", () => {
    const scenario = TRAINING_SCENARIOS.find((s) => s.id === "root-canal-challenge")!;
    const repaired =
      "Root canal therapy started on tooth 19. The patient reported no discomfort during " +
      "treatment and vital signs remained at baseline. Lidocaine 2% with epinephrine " +
      "1:100,000, 2 carpules, via inferior alveolar nerve block; the patient reported profound " +
      "numbness before access. Two periapical radiographs acquired of tooth 19; interpretation by the " +
      "treating dentist: periapical radiolucency at the mesial apex, no other findings. " +
      "Obturation planned at the second visit within two weeks.";
    expect(matchesScenarioEvidence(scenario, repaired)).toBe(true);
    expect(isScenarioComplete(runTextAudit(repaired))).toBe(true);
  });

  it("the perio case clears once the narrative points at the evidence", () => {
    const scenario = TRAINING_SCENARIOS.find((s) => s.id === "srp-justification")!;
    const repaired =
      "Scaling and root planing completed, upper right and lower right quadrants. Probing " +
      "depths of 5 mm with bleeding noted in the treated sextants and radiographic bone loss " +
      "documented in the current series. Oral hygiene instruction given; re-evaluation planned " +
      "in four to six weeks.";
    expect(matchesScenarioEvidence(scenario, repaired)).toBe(true);
    expect(isScenarioComplete(runTextAudit(repaired))).toBe(true);
  });

  it("the sedation case clears when the units agree", () => {
    const scenario = TRAINING_SCENARIOS.find((s) => s.id === "sedation-numbers")!;
    const repaired =
      "Pediatric patient, weight 20 kg, verified on the office scale. Midazolam dosed per the " +
      "time-oriented anesthesia record. Oral suspension administered as 10 mL by oral syringe " +
      "pre-operatively per the prescriber's order. Procedure completed; the patient met " +
      "discharge criteria and left with a parent.";
    expect(matchesScenarioEvidence(scenario, repaired)).toBe(true);
    expect(isScenarioComplete(runTextAudit(repaired))).toBe(true);
  });

  it("a clean unrelated note does not match scenario evidence", () => {
    const clean =
      "Adult prophylaxis completed. Soft tissue within normal limits. Oral hygiene instruction given.";
    for (const scenario of TRAINING_SCENARIOS) {
      expect(matchesScenarioEvidence(scenario, clean), scenario.id).toBe(false);
    }
  });

  it("ids are unique and bounties positive", () => {
    const ids = TRAINING_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of TRAINING_SCENARIOS) {
      expect(s.bounty).toBeGreaterThan(0);
      expect(s.requiredEvidence.length).toBeGreaterThan(0);
    }
  });
});
