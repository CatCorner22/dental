import { describe, expect, it } from "vitest";

import {
  ASSIGNABLE_CLINICAL_ROLES,
  canAssignClinicalRole,
  canRecordClinicalJudgement,
  CLINICAL_ROLES,
  CLINICAL_ROLE_HINT,
  CLINICAL_ROLE_LABEL,
  isClinicalRole,
  resolveClinicalRole
} from "./clinicalRoles";
import { authorCapabilities } from "@/lib/scope/authorCapabilities";

describe("the Smile Notes developer tier", () => {
  it("is a real clinical role with a label and a hint", () => {
    expect(isClinicalRole("smilenotes")).toBe(true);
    expect(CLINICAL_ROLES).toContain("smilenotes");
    expect(CLINICAL_ROLE_LABEL.smilenotes).toBe("Smile Notes");
    expect(CLINICAL_ROLE_HINT.smilenotes.length).toBeGreaterThan(0);
  });

  it("claims no Tennessee credential", () => {
    // licenseLevel drives LicenseScopeCard and the scope charts. A developer
    // account is not licensed, and the app must not render a chart row that
    // says otherwise.
    expect(authorCapabilities("smilenotes").licenseLevel).toBeNull();
    expect(authorCapabilities("dentist").licenseLevel).toBe("dentist");
  });

  it("is unrestricted on the product gates", () => {
    expect(canRecordClinicalJudgement("smilenotes")).toBe(true);
  });

  it("is not offered to a practice manager, and cannot be set by one", () => {
    expect(ASSIGNABLE_CLINICAL_ROLES).not.toContain("smilenotes");
    expect(canAssignClinicalRole("manager", "smilenotes")).toBe(false);
    expect(canAssignClinicalRole("lead", "smilenotes")).toBe(false);
    expect(canAssignClinicalRole("user", "smilenotes")).toBe(false);
    expect(canAssignClinicalRole("admin", "smilenotes")).toBe(true);
  });

  it("does not restrict who may set an ordinary credential", () => {
    for (const role of ASSIGNABLE_CLINICAL_ROLES) {
      expect(canAssignClinicalRole("manager", role), role).toBe(true);
    }
  });
});

describe("resolveClinicalRole", () => {
  it("gives a Smile Notes Developer the tier when nothing is recorded", () => {
    expect(resolveClinicalRole("admin", "unset")).toBe("smilenotes");
    expect(resolveClinicalRole("admin", null)).toBe("smilenotes");
    expect(resolveClinicalRole("admin", undefined)).toBe("smilenotes");
  });

  it("lets a recorded credential win over the derivation", () => {
    // A developer who genuinely holds a licence is that licence. The derivation
    // is a default for the unrecorded case, not an override.
    expect(resolveClinicalRole("admin", "dentist")).toBe("dentist");
    expect(resolveClinicalRole("admin", "hygienist")).toBe("hygienist");
  });

  it("follows the system role, so a demotion takes the tier with it", () => {
    // The whole reason this is derived rather than written to the row on
    // sign-in: a stored tier would outlive the account's authority to hold it.
    expect(resolveClinicalRole("manager", "unset")).toBe("unset");
    expect(resolveClinicalRole("lead", "unset")).toBe("unset");
    expect(resolveClinicalRole("user", "unset")).toBe("unset");
    expect(resolveClinicalRole("readonly", "unset")).toBe("unset");
  });

  it("falls back to unset for a value that is not a clinical role", () => {
    expect(resolveClinicalRole("user", "chief-of-staff")).toBe("unset");
    expect(resolveClinicalRole("user", 7)).toBe("unset");
  });
});
