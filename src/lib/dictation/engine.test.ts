import { describe, expect, it } from "vitest";
import { buildJsgfGrammar, DICTATION_LANG, dictationDisabled } from "./engine";

describe("dictation engine contract", () => {
  it("locks the product to U.S. English", () => {
    expect(DICTATION_LANG).toBe("en-US");
  });

  it("treats the deploy off-switch as exact string 1", () => {
    // dictationDisabled reads process.env at call time in Node tests.
    const prev = process.env.NEXT_PUBLIC_DICTATION_DISABLED;
    process.env.NEXT_PUBLIC_DICTATION_DISABLED = "1";
    expect(dictationDisabled()).toBe(true);
    process.env.NEXT_PUBLIC_DICTATION_DISABLED = "";
    expect(dictationDisabled()).toBe(false);
    process.env.NEXT_PUBLIC_DICTATION_DISABLED = prev;
  });

  it("sanitizes JSGF metacharacters in grammar phrases", () => {
    const g = buildJsgfGrammar(["a;b", "hello world"]);
    expect(g).not.toMatch(/a;b/);
    expect(g).toContain("hello world");
  });
});
