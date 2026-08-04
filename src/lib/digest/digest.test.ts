import { describe, expect, it } from "vitest";
import { DIGEST_RULES, buildDigest } from "./digest";
import { countLicencedOmissions, noteMetrics, parseFindingCounts, wordCount } from "./metrics";
import type { FiledNote } from "./metrics";
import { duplicatePairs, fingerprint, jaccard } from "./similarity";

const note = (over: Partial<FiledNote> = {}): FiledNote => ({
  submissionId: 1,
  authorId: "author-1",
  authorName: "A. Nurse (anurse)",
  filedAtIso: "2026-07-01T10:00:00Z",
  markdown: "#14 MOD composite placed. Prophylaxis completed.",
  auditReportJson: JSON.stringify({ counts: { S0: 0, S1: 0, S2: 0, S3: 0, S4: 0 } }),
  noteType: "restorative",
  ...over
});

const many = (n: number, over: Partial<FiledNote> = {}, startId = 1): FiledNote[] =>
  Array.from({ length: n }, (_, i) => note({ ...over, submissionId: startId + i }));

describe("metrics survive whatever the record holds", () => {
  it("returns zeroes for an unparseable frozen audit report", () => {
    expect(parseFindingCounts("not json")).toEqual({ S0: 0, S1: 0, S2: 0, S3: 0, S4: 0 });
    expect(parseFindingCounts("")).toEqual({ S0: 0, S1: 0, S2: 0, S3: 0, S4: 0 });
    expect(parseFindingCounts("null")).toEqual({ S0: 0, S1: 0, S2: 0, S3: 0, S4: 0 });
  });

  it("ignores nonsense values inside a well-formed report", () => {
    const counts = parseFindingCounts(JSON.stringify({ counts: { S0: -5, S1: "x", S2: 2.7 } }));
    expect(counts.S0).toBe(0);
    expect(counts.S1).toBe(0);
    expect(counts.S2).toBe(2);
  });

  it("counts words the way a person would", () => {
    expect(wordCount("")).toBe(0);
    expect(wordCount("   ")).toBe(0);
    expect(wordCount("-- ++ !!")).toBe(0);
    expect(wordCount("two words")).toBe(2);
  });

  it("counts an omission licence only when it is the whole answer", () => {
    expect(countLicencedOmissions("Medical history: not applicable")).toBe(1);
    // Buried in a real clinical sentence, it is not an omission.
    expect(
      countLicencedOmissions("Findings: the posterior guard is not applicable to this restoration plan")
    ).toBe(0);
  });

  it("gives a zero-word note no density rather than a misleading zero ratio", () => {
    expect(noteMetrics(note({ markdown: "" })).density).toBe(0);
    expect(noteMetrics(note({ markdown: "" })).words).toBe(0);
  });

  it("scores a dense note above a bloated one", () => {
    const dense = noteMetrics(note({ markdown: "#14 MOD composite placed. #3 extracted." }));
    const bloated = noteMetrics(
      note({
        markdown:
          "The patient arrived and was seated comfortably and we discussed at length the various considerations " +
          "relating to the overall plan and the patient expressed understanding of everything discussed today " +
          "and appeared satisfied with the conversation that we had about the general approach going forward."
      })
    );
    expect(dense.density).toBeGreaterThan(bloated.density);
  });
});

describe("RULE 2: never a verdict on one note", () => {
  it("says nothing about an author below the note minimum", () => {
    const notes = [
      ...many(3, { authorId: "a", authorName: "A", markdown: "words words words words words" }),
      ...many(12, { authorId: "b", authorName: "B" }, 100),
      ...many(12, { authorId: "c", authorName: "C" }, 200)
    ];
    const digest = buildDigest(notes, "2026-07-01", "2026-07-31");
    expect(digest.signals.some((s) => s.authorId === "a")).toBe(false);
  });

  it("makes no personal comparison in a practice too small to have a median", () => {
    const notes = [...many(15, { authorId: "a", authorName: "A" }), ...many(15, { authorId: "b", authorName: "B" }, 100)];
    const digest = buildDigest(notes, "2026-07-01", "2026-07-31");
    expect(digest.signals.filter((s) => s.scope === "person" && s.id.startsWith("density"))).toEqual([]);
  });
});

describe("RULE 4: if it applies to everyone, it is about the tool", () => {
  it("re-scopes to the practice and drops the names when most authors would be flagged", () => {
    // Five authors, four of them writing prose with no extractable facts. A
    // standard nobody meets is a badly set standard.
    const bloat =
      "The patient arrived and we discussed the plan at length and they understood everything we covered.";
    const notes = [
      ...many(12, { authorId: "a", authorName: "A", markdown: bloat }, 1),
      ...many(12, { authorId: "b", authorName: "B", markdown: bloat }, 100),
      ...many(12, { authorId: "c", authorName: "C", markdown: bloat }, 200),
      ...many(12, { authorId: "d", authorName: "D", markdown: bloat }, 300),
      ...many(12, { authorId: "e", authorName: "E" }, 400)
    ];
    const digest = buildDigest(notes, "2026-07-01", "2026-07-31");
    const density = digest.signals.filter((s) => s.id.includes("density"));
    for (const s of density) {
      expect(s.scope).toBe("practice");
      expect(s.authorName).toBeUndefined();
    }
  });

  it("names an individual only when they are the exception, not the rule", () => {
    const bloat = "The patient arrived and we discussed the plan at length and they understood it all.";
    const notes = [
      ...many(12, { authorId: "a", authorName: "A. Outlier", markdown: bloat }, 1),
      ...many(12, { authorId: "b", authorName: "B" }, 100),
      ...many(12, { authorId: "c", authorName: "C" }, 200),
      ...many(12, { authorId: "d", authorName: "D" }, 300),
      ...many(12, { authorId: "e", authorName: "E" }, 400)
    ];
    const digest = buildDigest(notes, "2026-07-01", "2026-07-31");
    const density = digest.signals.filter((s) => s.id.startsWith("density"));
    expect(density).toHaveLength(1);
    expect(density[0].scope).toBe("person");
    expect(density[0].authorName).toBe("A. Outlier");
  });
});

describe("RULE 3: like compared with like", () => {
  it("reports tool coverage per note type rather than pooling them", () => {
    const notes = [
      ...many(12, { noteType: "hygiene", markdown: "zzz qqq wibble frobnicate" }, 1),
      ...many(12, { noteType: "restorative" }, 100)
    ];
    const digest = buildDigest(notes, "2026-07-01", "2026-07-31");
    const coverage = digest.signals.filter((s) => s.id.startsWith("practice.coverage"));
    expect(coverage.some((s) => s.id.includes("hygiene"))).toBe(true);
    expect(coverage.some((s) => s.id.includes("restorative"))).toBe(false);
  });

  it("puts the tool's own limitation first in the list", () => {
    const notes = many(12, { noteType: "hygiene", markdown: "zzz qqq wibble frobnicate" });
    const digest = buildDigest(notes, "2026-07-01", "2026-07-31");
    expect(digest.signals[0].id).toContain("practice.coverage");
  });
});

describe("copy-forward, told apart from a template working", () => {
  const body = "Prophylaxis completed. Oral hygiene instruction given. Recall scheduled. No caries noted today.";

  it("does NOT flag identical wording when the teeth differ", () => {
    const prints = [
      fingerprint({ submissionId: 1, authorId: "a", noteType: "t", markdown: `${body} #14 MOD composite placed.` }),
      fingerprint({ submissionId: 2, authorId: "a", noteType: "t", markdown: `${body} #30 MOD composite placed.` })
    ];
    expect(duplicatePairs(prints)).toEqual([]);
  });

  it("flags identical wording naming the same teeth", () => {
    const text = `${body} #14 MOD composite placed.`;
    const prints = [
      fingerprint({ submissionId: 1, authorId: "a", noteType: "t", markdown: text }),
      fingerprint({ submissionId: 2, authorId: "a", noteType: "t", markdown: text })
    ];
    const pairs = duplicatePairs(prints);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].kind).toBe("same-sites");
  });

  it("flags identical boilerplate carrying no facts at all", () => {
    const text = "The patient arrived and we discussed the plan and everything was reviewed and understood.";
    const prints = [
      fingerprint({ submissionId: 1, authorId: "a", noteType: "t", markdown: text }),
      fingerprint({ submissionId: 2, authorId: "a", noteType: "t", markdown: text })
    ];
    expect(duplicatePairs(prints)[0]?.kind).toBe("no-facts");
  });

  it("never compares one person's notes against another's", () => {
    const text = "The patient arrived and we discussed the plan and everything was reviewed and understood.";
    const prints = [
      fingerprint({ submissionId: 1, authorId: "a", noteType: "t", markdown: text }),
      fingerprint({ submissionId: 2, authorId: "b", noteType: "t", markdown: text })
    ];
    expect(duplicatePairs(prints)).toEqual([]);
  });

  it("jaccard is sane at the edges", () => {
    expect(jaccard(new Set(), new Set())).toBe(1);
    expect(jaccard(new Set(["a"]), new Set())).toBe(0);
    expect(jaccard(new Set(["a"]), new Set(["a"]))).toBe(1);
  });
});

describe("the digest as a whole", () => {
  it("says so plainly when there is nothing to report", () => {
    const digest = buildDigest(many(12, { markdown: "#14 MOD composite placed." }), "2026-07-01", "2026-07-31");
    // Identical notes on the same tooth WILL raise copy-forward; use varied ones.
    const varied = buildDigest(
      Array.from({ length: 12 }, (_, i) =>
        note({ submissionId: i + 1, markdown: `#${i + 2} MOD composite placed. Prophylaxis completed.` })
      ),
      "2026-07-01",
      "2026-07-31"
    );
    expect(varied.allClear).toBe(true);
    expect(varied.signals).toEqual([]);
    expect(digest.notesReviewed).toBe(12);
  });

  it("never names anyone in a headline without a sample behind it", () => {
    const bloat = "The patient arrived and we discussed the plan at length and they understood it all.";
    const notes = [
      ...many(12, { authorId: "a", authorName: "A. Outlier", markdown: bloat }, 1),
      ...many(12, { authorId: "b", authorName: "B" }, 100),
      ...many(12, { authorId: "c", authorName: "C" }, 200),
      ...many(12, { authorId: "d", authorName: "D" }, 300)
    ];
    for (const s of buildDigest(notes, "2026-07-01", "2026-07-31").signals) {
      if (s.scope === "person") expect(s.sample).toBeGreaterThanOrEqual(DIGEST_RULES.MIN_NOTES_PER_AUTHOR);
    }
  });

  it("never scolds — no headline contains a judgement word", () => {
    const bloat = "The patient arrived and we discussed the plan at length and they understood it all.";
    const notes = [
      ...many(12, { authorId: "a", authorName: "A", markdown: bloat }, 1),
      ...many(12, { authorId: "b", authorName: "B" }, 100),
      ...many(12, { authorId: "c", authorName: "C" }, 200),
      ...many(12, { authorId: "d", authorName: "D" }, 300)
    ];
    const banned = /\b(lazy|laziness|sloppy|careless|poor|bad|worst|failure|failing|unacceptable)\b/i;
    for (const s of buildDigest(notes, "2026-07-01", "2026-07-31").signals) {
      expect(s.headline).not.toMatch(banned);
      expect(s.detail).not.toMatch(banned);
    }
  });

  it.each([[[] as FiledNote[]], [many(1)], [many(2, { markdown: "" })]])(
    "never throws on a thin period",
    (notes) => {
      expect(() => buildDigest(notes, "2026-07-01", "2026-07-31")).not.toThrow();
    }
  );

  it("is deterministic", () => {
    const notes = many(14, { markdown: "#14 MOD composite placed." });
    const once = JSON.stringify(buildDigest(notes, "2026-07-01", "2026-07-31"));
    expect(JSON.stringify(buildDigest(notes, "2026-07-01", "2026-07-31"))).toBe(once);
  });
});
