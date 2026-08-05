import { afterEach, describe, expect, it } from "vitest";
import { mfaFeatureEnabled } from "./mfaFeature";

const ORIGINAL = process.env.MFA_ENABLED;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.MFA_ENABLED;
  else process.env.MFA_ENABLED = ORIGINAL;
});

describe("mfaFeatureEnabled", () => {
  it("is OFF when unset — the safe default for a one-Developer deployment", () => {
    delete process.env.MFA_ENABLED;
    expect(mfaFeatureEnabled()).toBe(false);
  });

  it("is OFF for 0, empty, and other values", () => {
    for (const v of ["0", "", "true", "yes", "on"]) {
      process.env.MFA_ENABLED = v;
      expect(mfaFeatureEnabled(), JSON.stringify(v)).toBe(false);
    }
  });

  it("is ON only for 1 (whitespace tolerated)", () => {
    process.env.MFA_ENABLED = "1";
    expect(mfaFeatureEnabled()).toBe(true);
    process.env.MFA_ENABLED = " 1 ";
    expect(mfaFeatureEnabled()).toBe(true);
  });
});
