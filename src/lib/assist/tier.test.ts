import { describe, expect, it } from "vitest";

import { capabilityTier, predictiveCapabilities, tierExplanation } from "./tier";
import { ASSIST_CAPABILITIES } from "./prompts";
import { CLINICAL_ROLES, type ClinicalRole } from "@/lib/auth/clinicalRoles";

// The licence decides which half of assist answers. Every capability has a
// deterministic twin that ships in this repository, so "deterministic" is never
// "nothing" — which is exactly why this can be a rule rather than a refusal.

describe("capabilityTier", () => {
  it("answers for every role and every capability", () => {
    // No role may fall through to undefined. A capability with no tier is a
    // capability whose gate is whatever the route happens to do next.
    for (const role of CLINICAL_ROLES) {
      for (const capability of ASSIST_CAPABILITIES) {
        expect(["predictive", "deterministic"], `${role}/${capability}`).toContain(
          capabilityTier(role, capability)
        );
      }
    }
  });

  it("gives an unrecorded licence the deterministic half, for every capability", () => {
    // Pinned explicitly, because this is a DELIBERATE break with the permissive
    // "unset" default used by canRecordClinicalJudgement, checkFilingAuthority
    // and the template scaffolds. If someone later "fixes the inconsistency",
    // this test is where they find out it was a decision.
    for (const capability of ASSIST_CAPABILITIES) {
      expect(capabilityTier("unset", capability), capability).toBe("deterministic");
    }
    expect(predictiveCapabilities("unset", ASSIST_CAPABILITIES)).toEqual([]);
  });

  it("gives a dentist the predictive half of everything", () => {
    for (const capability of ASSIST_CAPABILITIES) {
      expect(capabilityTier("dentist", capability), capability).toBe("predictive");
    }
  });

  it("lets an auxiliary reword and re-section their own text", () => {
    // normalize and soap only move and re-word what the writer already wrote.
    // Nothing about them states a conclusion, so no licence needs to gate them.
    for (const role of ["hygienist", "assistant"] as ClinicalRole[]) {
      expect(capabilityTier(role, "normalize"), role).toBe("predictive");
      expect(capabilityTier(role, "soap"), role).toBe("predictive");
      expect(capabilityTier(role, "extract"), role).toBe("predictive");
    }
  });

  it("keeps generated clinical conclusions away from an auxiliary", () => {
    // "What is missing from this note" is a fair documentation question and the
    // deterministic twin answers it. Being handed a MODEL's assessment to sign
    // is the tool walking someone into an act outside their scope.
    for (const role of ["hygienist", "assistant"] as ClinicalRole[]) {
      expect(capabilityTier(role, "interrogate"), role).toBe("deterministic");
      expect(capabilityTier(role, "conflicts"), role).toBe("deterministic");
    }
  });

  it("gives the developer tier the predictive half, so every path can be exercised", () => {
    for (const capability of ASSIST_CAPABILITIES) {
      expect(capabilityTier("smilenotes", capability), capability).toBe("predictive");
    }
  });
});

describe("tierExplanation", () => {
  it("never reads as a refusal, and always says what answered", () => {
    for (const role of CLINICAL_ROLES) {
      const text = tierExplanation(role);
      expect(text.length, role).toBeGreaterThan(20);
      // The deterministic half ANSWERED. Wording that implies the user was
      // blocked would be a lie about what just happened.
      expect(text.toLowerCase(), role).not.toContain("not allowed");
      expect(text.toLowerCase(), role).not.toContain("permission");
      expect(text.toLowerCase(), role).not.toContain("denied");
    }
  });

  it("tells an unrecorded account exactly what would change it", () => {
    expect(tierExplanation("unset")).toContain("User admin");
  });
});
