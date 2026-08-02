import { describe, expect, it } from "vitest";
import { PASSWORD_MAX, PASSWORD_MIN, passwordPolicyError } from "./password";

describe("passwordPolicyError", () => {
  it("accepts a password within the policy", () => {
    expect(passwordPolicyError("a-good-passphrase")).toBeNull();
  });

  it("rejects one shorter than the minimum", () => {
    expect(passwordPolicyError("x".repeat(PASSWORD_MIN - 1))).toContain("at least");
  });

  // bcrypt ignores bytes past 72, so anything longer is not stronger — it
  // silently collides with its own first 72 bytes, and hashing an unbounded
  // string is free CPU for an attacker.
  it("rejects one longer than bcrypt's significant length", () => {
    expect(passwordPolicyError("x".repeat(PASSWORD_MAX + 1))).toContain("at most");
  });

  it("measures the cap in bytes, not characters", () => {
    // Each of these is 3 bytes in UTF-8, so 25 of them exceed 72 bytes
    // while being only 25 characters long.
    expect(passwordPolicyError("한".repeat(25))).toContain("at most");
    expect(passwordPolicyError("한".repeat(20))).toBeNull();
  });
});
