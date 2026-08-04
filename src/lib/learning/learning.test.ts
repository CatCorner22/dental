import { describe, expect, it } from "vitest";
import { REDACTED, redactEvidence, redactedContext } from "./redact";
import { buildProposal, judgeEffect, meetsThreshold, rankProposals, THRESHOLDS } from "./proposals";
import type { RulesetMetrics, Sighting } from "./proposals";

describe("redaction fails closed", () => {
  it("removes a name even though no rule knows it is a name", () => {
    // The point of an allow-list: it does not need to recognise "Kowalczyk".
    const out = redactEvidence("Kowalczyk tolerated the procedure well");
    expect(out).not.toContain("Kowalczyk");
    expect(out).toContain(REDACTED);
  });

  it("removes a given name that is also a plausible clinical word", () => {
    for (const name of ["Bill", "Mark", "Rose", "Grant"]) {
      expect(redactEvidence(`${name} presented today`)).not.toContain(name);
    }
  });

  it("keeps controlled clinical vocabulary, so evidence stays readable", () => {
    const out = redactEvidence("composite restoration placed on the tooth");
    expect(out).toContain("composite");
    expect(out).toContain("restoration");
  });

  it("redacts every number wholesale, including ones that look clinical", () => {
    // A DOB, an age over 89, a record number's last four and a tooth number are
    // all small integers, and the words that would tell them apart have just
    // been redacted.
    const out = redactEvidence("seen 14 times since 1962 at 4419 Oak");
    expect(out).not.toMatch(/\d/);
  });

  it("redacts alphanumeric identifiers", () => {
    expect(redactEvidence("record MRN4419X updated")).not.toContain("MRN4419X");
  });

  it.each([
    "",
    "   ",
    "\u0000\u0001",
    "!!!!",
    "…",
    "a".repeat(2000),
    "🙂 🦷 emoji only"
  ])("never throws on %j", (input) => {
    expect(() => redactEvidence(input)).not.toThrow();
  });

  it("is idempotent — redacting twice changes nothing", () => {
    const once = redactEvidence("Kowalczyk had composite placed on 14");
    expect(redactEvidence(once)).toBe(once);
  });
});

describe("redacted context keeps the subject and nothing else risky", () => {
  it("preserves the token under review", () => {
    const ctx = redactedContext("Patient Kowalczyk had bpe recorded today", "bpe");
    expect(ctx).toContain("bpe");
    expect(ctx).not.toContain("Kowalczyk");
  });

  it("returns undefined when the token is absent", () => {
    expect(redactedContext("nothing here", "bpe")).toBeUndefined();
  });
});

const sighting = (text: string, authorId: string, filedAt = "2026-07-01"): Sighting => ({
  text,
  authorId,
  filedAt
});

describe("thresholds keep one person's habit out of the practice vocabulary", () => {
  const many = (n: number, authorId: string) =>
    Array.from({ length: n }, (_, i) => sighting(`bpe recorded and bpe reviewed ${i}`, authorId));

  it("refuses a proposal from a single author, however often they said it", () => {
    const proposal = buildProposal("vocabulary", "bpe", "Add to the vocabulary.", many(30, "author-1"));
    expect(proposal).toBeUndefined();
  });

  it("refuses a proposal below the note threshold", () => {
    const sightings = [sighting("bpe bpe bpe bpe bpe bpe bpe bpe bpe", "a"), sighting("bpe", "b")];
    expect(buildProposal("vocabulary", "bpe", "Add.", sightings)).toBeUndefined();
  });

  it("accepts a genuinely shared convention", () => {
    const sightings = [
      ...many(3, "author-1"),
      ...many(2, "author-2"),
      ...many(2, "author-3")
    ];
    const proposal = buildProposal("vocabulary", "bpe", "Add to the vocabulary.", sightings);
    expect(proposal).toBeDefined();
    expect(proposal!.evidence.authors).toBe(3);
    expect(proposal!.state).toBe("proposed");
  });

  it("caps the contexts it shows", () => {
    const sightings = Array.from({ length: 40 }, (_, i) =>
      sighting(`unique word${i} bpe recorded today`, `author-${i % 4}`)
    );
    const proposal = buildProposal("vocabulary", "bpe", "Add.", sightings);
    expect(proposal!.evidence.contexts.length).toBeLessThanOrEqual(THRESHOLDS.MAX_CONTEXTS);
  });

  it("never carries an unredacted name into evidence", () => {
    const sightings = Array.from({ length: 12 }, (_, i) =>
      sighting("Kowalczyk had bpe recorded and bpe reviewed", `author-${i % 3}`)
    );
    const proposal = buildProposal("vocabulary", "bpe", "Add.", sightings);
    for (const ctx of proposal!.evidence.contexts) {
      expect(ctx).not.toContain("Kowalczyk");
    }
  });

  it("handles a subject containing regex metacharacters", () => {
    expect(() => buildProposal("vocabulary", "c/o(", "Add.", [sighting("c/o( pain", "a")])).not.toThrow();
  });

  it("returns nothing for no sightings", () => {
    expect(buildProposal("vocabulary", "bpe", "Add.", [])).toBeUndefined();
  });
});

describe("ranking puts breadth before depth", () => {
  it("prefers a term several people use over one person's frequent habit", () => {
    const shared = buildProposal(
      "vocabulary",
      "bpe",
      "Add.",
      Array.from({ length: 8 }, (_, i) => sighting("bpe recorded and bpe again", `author-${i % 4}`))
    )!;
    const personal = buildProposal(
      "vocabulary",
      "xyz",
      "Add.",
      Array.from({ length: 8 }, (_, i) => sighting("xyz xyz xyz xyz xyz xyz", `author-${i % 2}`))
    )!;
    expect(personal.evidence.occurrences).toBeGreaterThan(shared.evidence.occurrences);
    expect(rankProposals([personal, shared])[0].subject).toBe("bpe");
  });
});

const metrics = (over: Partial<RulesetMetrics> = {}): RulesetMetrics => ({
  coverage: 0.7,
  findingsPerNote: 4,
  omissionRate: 0.1,
  notesSampled: 100,
  ...over
});

describe("the loop closes: a change is judged after it ships", () => {
  const measure = (before: RulesetMetrics, after: RulesetMetrics) => ({
    proposalId: "vocabulary:bpe",
    appliedInVersion: "2.9.0",
    before,
    after
  });

  it("calls a coverage gain an improvement", () => {
    expect(judgeEffect(measure(metrics(), metrics({ coverage: 0.78 })))).toBe("improved");
  });

  it("calls a coverage loss a regression", () => {
    expect(judgeEffect(measure(metrics(), metrics({ coverage: 0.6 })))).toBe("regressed");
  });

  // THE ONE THAT MATTERS. A change can raise coverage and still make notes
  // worse, by making the tool easier to satisfy rather than making the writing
  // better. Omission rate outranks coverage for exactly that reason.
  it("calls a coverage gain bought with more 'not applicable' a REGRESSION", () => {
    const after = metrics({ coverage: 0.85, omissionRate: 0.22 });
    expect(judgeEffect(measure(metrics(), after))).toBe("regressed");
  });

  it("refuses to declare victory on a small sample", () => {
    const before = metrics({ notesSampled: 4 });
    const after = metrics({ coverage: 0.99, notesSampled: 4 });
    expect(judgeEffect(measure(before, after))).toBe("insufficient-data");
  });

  it("says so plainly when nothing measurable happened", () => {
    expect(judgeEffect(measure(metrics(), metrics({ coverage: 0.705 })))).toBe("no-measurable-change");
  });
});

describe("threshold predicate", () => {
  it("requires all three conditions, not any", () => {
    expect(
      meetsThreshold({
        occurrences: 100,
        notes: 100,
        authors: 1,
        contexts: [],
        firstSeen: "2026-01-01",
        lastSeen: "2026-01-02"
      })
    ).toBe(false);
  });
});
