import { describe, expect, it } from "vitest";
import { currentCodeForTest, generateMfaSecret, mfaEnrollmentUri, verifyMfaCode } from "./totp";

const T0 = 1_754_200_000_000; // fixed instant

describe("TOTP", () => {
  it("generates distinct base32 secrets", () => {
    const a = generateMfaSecret();
    const b = generateMfaSecret();
    expect(a).toMatch(/^[A-Z2-7]+$/);
    expect(a).not.toBe(b);
  });

  it("accepts the current code and the adjacent windows, rejects beyond", () => {
    const secret = generateMfaSecret();
    const code = currentCodeForTest("drsmith", secret, T0);
    expect(verifyMfaCode("drsmith", secret, code, T0)).toBe(true);
    // Same code thirty seconds later: still inside the +/-1 window.
    expect(verifyMfaCode("drsmith", secret, code, T0 + 30_000)).toBe(true);
    // Two minutes later: a stale code must die.
    expect(verifyMfaCode("drsmith", secret, code, T0 + 120_000)).toBe(false);
  });

  it("tolerates spaces and rejects non-six-digit input outright", () => {
    const secret = generateMfaSecret();
    const code = currentCodeForTest("drsmith", secret, T0);
    const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
    expect(verifyMfaCode("drsmith", secret, spaced, T0)).toBe(true);
    expect(verifyMfaCode("drsmith", secret, "12345", T0)).toBe(false);
    expect(verifyMfaCode("drsmith", secret, "abcdef", T0)).toBe(false);
    expect(verifyMfaCode("drsmith", secret, "", T0)).toBe(false);
  });

  it("a code from one secret never validates against another", () => {
    const a = generateMfaSecret();
    const b = generateMfaSecret();
    const code = currentCodeForTest("drsmith", a, T0);
    expect(verifyMfaCode("drsmith", b, code, T0)).toBe(false);
  });

  it("a malformed stored secret fails closed", () => {
    expect(verifyMfaCode("drsmith", "not-base32!!", "123456", T0)).toBe(false);
  });

  it("the enrollment URI carries issuer and label", () => {
    const secret = generateMfaSecret();
    const uri = mfaEnrollmentUri("drsmith", secret);
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain("Smile%20Notes");
    expect(uri).toContain("drsmith");
    expect(uri).toContain(`secret=${secret}`);
  });
});
