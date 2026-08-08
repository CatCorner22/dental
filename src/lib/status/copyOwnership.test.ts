import { describe, expect, it } from "vitest";
import { copyBlockedForDentistJudgement } from "./copyOwnership";
import type { AuditFinding } from "@/lib/audit/types";

const rationale: AuditFinding = {
  ruleId: "complete.clinical-rationale",
  category: "required",
  severity: "S2",
  message: "Clinical rationale missing."
};

const consent: AuditFinding = {
  ruleId: "complete.consent-no-decision",
  category: "required",
  severity: "S2",
  message: "Consent decision missing."
};

describe("copyBlockedForDentistJudgement — Honest Finish", () => {
  it("does not block a dentist with open rationale killers", () => {
    expect(
      copyBlockedForDentistJudgement({
        clinicalRole: "dentist",
        killers: [rationale]
      })
    ).toBe(false);
  });

  it("blocks a hygienist when a dentist-judgement killer is open", () => {
    expect(
      copyBlockedForDentistJudgement({
        clinicalRole: "hygienist",
        killers: [rationale]
      })
    ).toBe(true);
  });

  it("does not block a hygienist for non-judgement killers (Soft S2 ack path)", () => {
    expect(
      copyBlockedForDentistJudgement({
        clinicalRole: "hygienist",
        killers: [consent]
      })
    ).toBe(false);
  });

  it("does not block when there are no killers", () => {
    expect(
      copyBlockedForDentistJudgement({
        clinicalRole: "assistant",
        killers: []
      })
    ).toBe(false);
  });
});
