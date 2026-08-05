import { describe, expect, it } from "vitest";
import { PASSWORD_HINT, PASSWORD_MAX, PASSWORD_MIN, passwordPolicyError } from "./password";

describe("passwordPolicyError", () => {
  it("accepts a password within the policy", () => {
    expect(passwordPolicyError("a-good-passphrase")).toBeNull();
  });

  it("rejects one shorter than the minimum", () => {
    const msg = passwordPolicyError("x".repeat(PASSWORD_MIN - 1)) ?? "";
    expect(msg).toContain("at least");
    // Must not sound like "pick letters OR digits OR symbols" — that reading
    // locked a site owner out of /setup thinking only one class was allowed.
    expect(msg.toLowerCase()).toMatch(/mix|no character-type/);
  });

  it("exposes a hint that any character mix is fine", () => {
    expect(PASSWORD_HINT.toLowerCase()).toContain("mix");
    expect(PASSWORD_HINT.toLowerCase()).toContain("no rule");
  });

  // bcrypt ignores bytes past 72, so anything longer is not stronger — it
  // silently collides with its own first 72 bytes, and hashing an unbounded
  // string is free CPU for an attacker.
  it("rejects one longer than bcrypt's significant length", () => {
    expect(passwordPolicyError("x".repeat(PASSWORD_MAX + 1))).toContain("at most");
  });

  it("measures the cap in bytes, not characters", () => {
    // Each Korean syllable is 3 bytes in UTF-8, so 25 exceed 72 bytes while
    // being only 25 characters long.
    expect(passwordPolicyError("한".repeat(25))).toContain("at most");
    // A VARIED 20-char multibyte string (60 bytes) is within the cap and
    // otherwise fine — not a single repeated character.
    expect(passwordPolicyError("가나다라마바사아자차카타파하거너더러머버")).toBeNull();
  });

  // Length is not entropy: these clear the character minimum but are the first
  // things an online guesser tries.
  it("rejects a single repeated character", () => {
    expect(passwordPolicyError("a".repeat(PASSWORD_MIN))).toContain("repeated");
    expect(passwordPolicyError("aaaaaaaaaaaa")).toContain("repeated");
  });

  it("rejects common long passwords, case-insensitively", () => {
    expect(passwordPolicyError("password123")).toContain("common");
    expect(passwordPolicyError("Password123")).toContain("common");
    expect(passwordPolicyError("1234567890")).toContain("common");
  });
});
