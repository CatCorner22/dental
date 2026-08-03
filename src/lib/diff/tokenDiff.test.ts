import { describe, expect, it } from "vitest";
import { countWords, diffTokens, isFormattingOnly, tokenize } from "./tokenDiff";
import { standardize } from "@/lib/standardize/standardize";

const render = (spans: ReturnType<typeof diffTokens>) =>
  spans
    .map((s) => (s.op === "same" ? s.text : s.op === "added" ? `{+${s.text}+}` : `[-${s.text}-]`))
    .join("");

describe("word-level diff", () => {
  it("reconstructs the original from the removed and same spans", () => {
    // The property that makes a diff trustworthy: it is a decomposition of the
    // two texts, not a summary of them. If either side cannot be rebuilt, the
    // rendering is showing the clinician something that never existed.
    const cases: Array<[string, string]> = [
      ["Pt c/o pain", "Patient complains of pain."],
      ["", "New text."],
      ["Old text.", ""],
      ["identical", "identical"],
      ["a b c d e", "a x c y e"],
      ["one two three", "three two one"]
    ];
    for (const [before, after] of cases) {
      const spans = diffTokens(before, after);
      const rebuiltBefore = spans.filter((s) => s.op !== "added").map((s) => s.text).join("");
      const rebuiltAfter = spans.filter((s) => s.op !== "removed").map((s) => s.text).join("");
      expect(rebuiltBefore, `before: ${before}`).toBe(before);
      expect(rebuiltAfter, `after: ${after}`).toBe(after);
    }
  });

  it("marks only what actually changed", () => {
    expect(render(diffTokens("the quick brown fox", "the slow brown fox"))).toBe(
      "the [-quick-]{+slow+} brown fox"
    );
  });

  it("returns one span for identical text", () => {
    expect(diffTokens("same words", "same words")).toEqual([{ op: "same", text: "same words" }]);
  });

  it("returns nothing for two empty strings", () => {
    expect(diffTokens("", "")).toEqual([]);
  });

  it("merges adjacent edits so a rewritten phrase reads as one change", () => {
    const spans = diffTokens("a b c", "a x y z c");
    // Not five word-sized spans.
    expect(spans.filter((s) => s.op === "added")).toHaveLength(1);
  });

  it("keeps whitespace as its own token so words stay intact", () => {
    expect(tokenize("two words")).toEqual(["two", " ", "words"]);
  });
});

describe("formatting-only detection", () => {
  it("treats an added terminal period as formatting", () => {
    expect(isFormattingOnly("No bleeding", "No bleeding.")).toBe(true);
  });

  it("treats collapsed whitespace as formatting", () => {
    expect(isFormattingOnly("a  b", "a b")).toBe(true);
  });

  it("does NOT treat a word substitution as formatting", () => {
    expect(isFormattingOnly("x-ray taken", "radiograph taken")).toBe(false);
  });

  it("does not hide a real change that arrives alongside punctuation", () => {
    // The failure this guards: a substitution plus a terminal period must never
    // collapse into "formatting only", which would hide the substitution.
    expect(isFormattingOnly("Pt hx of bruxism", "Patient history of bruxism.")).toBe(false);
  });

  it("calls an unchanged text formatting-only", () => {
    expect(isFormattingOnly("same", "same")).toBe(true);
  });
});

describe("word counts for the summary line", () => {
  it("counts words, not spans or whitespace", () => {
    const spans = diffTokens("the quick brown fox", "the slow brown fox");
    expect(countWords(spans, "removed")).toBe(1);
    expect(countWords(spans, "added")).toBe(1);
  });
});

describe("the diff describes what Standardize actually did", () => {
  it("shows the shorthand expansion the panel reports", () => {
    // Ties the new view to the existing pipeline: whatever standardize()
    // changed must be visible in the diff of its own input and output.
    const input = "Pt c/o pain, hx of bruxism";
    const out = standardize(input).text;
    const spans = diffTokens(input, out);
    expect(isFormattingOnly(input, out)).toBe(false);
    const added = spans.filter((s) => s.op === "added").map((s) => s.text).join(" ");
    expect(added.toLowerCase()).toContain("patient");
    expect(added.toLowerCase()).toContain("history");
  });

  it("collapses a run that only gained a full stop", () => {
    const input = "No complication was observed";
    const out = standardize(input).text;
    expect(out).not.toBe(input);
    expect(isFormattingOnly(input, out)).toBe(true);
  });
});

describe("bounds", () => {
  it("falls back to a whole-text replacement rather than a huge table", () => {
    const before = "word ".repeat(5000);
    const after = "other ".repeat(5000);
    const spans = diffTokens(before, after);
    expect(spans).toEqual([
      { op: "removed", text: before },
      { op: "added", text: after }
    ]);
  });

  it("stays fast on a realistically long field", () => {
    const before = "The clinician observed generalized inflammation at multiple sites. ".repeat(30);
    const after = before.replace(/generalized/g, "widespread");
    const start = performance.now();
    const spans = diffTokens(before, after);
    expect(performance.now() - start).toBeLessThan(500);
    expect(countWords(spans, "added")).toBeGreaterThan(0);
  });
});
