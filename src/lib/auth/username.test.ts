import { describe, expect, it } from "vitest";
import { isValidUsername, usernamePolicyError } from "./username";

describe("usernamePolicyError", () => {
  it("accepts mixed letters, digits, and allowed punctuation", () => {
    expect(usernamePolicyError("blake.r")).toBeNull();
    expect(usernamePolicyError("Nurse_22")).toBeNull();
    expect(usernamePolicyError("a1-b2")).toBeNull();
    expect(isValidUsername("blake.r")).toBe(true);
  });

  it("rejects spaces and empty", () => {
    expect(usernamePolicyError("")).toContain("Pick");
    expect(usernamePolicyError("blake reagan")).toMatch(/mix letters/i);
    expect(usernamePolicyError("blake reagan")).toMatch(/No spaces/);
  });

  it("rejects too-short names", () => {
    expect(usernamePolicyError("ab")).toMatch(/3–40/);
  });

  it("says you may mix character types — not pick one", () => {
    const msg = usernamePolicyError("bad name!") ?? "";
    expect(msg.toLowerCase()).toContain("mix");
    expect(msg.toLowerCase()).not.toMatch(/\bor\b.*\bor\b/);
  });
});
