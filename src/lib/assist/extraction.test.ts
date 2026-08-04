import { describe, expect, it } from "vitest";
import {
  locateQuote,
  validateExtraction,
  verifyExtraction,
  type ProposedFact
} from "./extraction";

const NOTE =
  "Pt c/o pain UR quad x3 days. #3 perc +, no swelling. 2 carp lido 2% w epi. " +
  "RCT #3 started, CaOH placed. RTC 2 wks.";

const fact = (over: Partial<ProposedFact>): ProposedFact => ({
  kind: "medication",
  statement: "2 carpules of lidocaine 2% with epinephrine",
  quote: "2 carp lido 2% w epi",
  confidence: "high",
  ...over
});

// ===========================================================================
// THE ACCEPTANCE TEST, from the owner's blueprint: no AI-generated clinical
// fact without visible source evidence. These adversaries are models that try
// to get a fact through without earning it.
// ===========================================================================
describe("adversaries: every way a model can fail to earn a fact", () => {
  it("refuses a fact whose quote is not in the text — the fabricated citation", () => {
    const result = verifyExtraction(NOTE, [
      fact({ quote: "3 carp articaine 4%", statement: "3 carpules of articaine 4%" })
    ]);
    expect(result.pinned).toEqual([]);
    expect(result.refused[0].code).toBe("extract.quote-not-found");
  });

  it("refuses a paraphrased quote — a paraphrase is not evidence", () => {
    const result = verifyExtraction(NOTE, [
      fact({ quote: "two carpules of lidocaine two percent" })
    ]);
    expect(result.refused[0]?.code).toBe("extract.quote-not-found");
  });

  it("refuses an invented number, even with a genuine quote", () => {
    // The quote is real; the statement upgrades 2 carpules to 4. This is the
    // single most dangerous thing an extractor can do to a dose record.
    const result = verifyExtraction(NOTE, [
      fact({ statement: "4 carpules of lidocaine 2% with epinephrine" })
    ]);
    expect(result.pinned).toEqual([]);
    expect(result.refused[0].code).toBe("extract.invented-number");
    expect(result.refused[0].reason).toContain("4");
  });

  it("refuses a changed tooth number", () => {
    const result = verifyExtraction(NOTE, [
      fact({
        kind: "procedure",
        statement: "root canal therapy started on tooth 30",
        quote: "RCT #3 started"
      })
    ]);
    expect(result.refused[0].code).toBe("extract.invented-number");
  });

  it("refuses a statement the quote denies — the polarity flip", () => {
    // "no swelling" cannot pin "swelling". An extractor that reads an absence
    // as a presence is inverting the most safety-relevant sentences a dental
    // note contains.
    const result = verifyExtraction(NOTE, [
      fact({ kind: "finding", statement: "swelling present", quote: "no swelling" })
    ]);
    expect(result.pinned).toEqual([]);
    expect(result.refused[0].code).toBe("extract.polarity-conflict");
  });

  it("accepts a statement that AGREES with its negated quote", () => {
    const result = verifyExtraction(NOTE, [
      fact({ kind: "finding", statement: "no swelling", quote: "no swelling" })
    ]);
    expect(result.refused).toEqual([]);
    expect(result.pinned).toHaveLength(1);
  });

  it("refuses even 'observed' added to a faithful negation — attestation is not in the quote", () => {
    // Stricter than intuition, and correct: "no swelling OBSERVED" claims an
    // observation event the quote never states. The writer typed an absence;
    // who observed it and how is exactly the kind of detail an extractor must
    // not supply on the writer's behalf.
    const result = verifyExtraction(NOTE, [
      fact({ kind: "finding", statement: "no swelling observed", quote: "no swelling" })
    ]);
    expect(result.pinned).toEqual([]);
    expect(result.refused[0].code).toBe("extract.ungrounded");
  });

  it("refuses a drug the quote never mentions", () => {
    const result = verifyExtraction(NOTE, [
      fact({ statement: "amoxicillin administered", quote: "2 carp lido 2% w epi" })
    ]);
    expect(result.pinned).toEqual([]);
    expect(["extract.ungrounded", "extract.invented-number"]).toContain(result.refused[0].code);
  });

  it("one bad fact never poisons the batch — refusal is per fact", () => {
    const result = verifyExtraction(NOTE, [
      fact({}),
      fact({ quote: "not in the note at all", statement: "prophylaxis completed" })
    ]);
    expect(result.pinned).toHaveLength(1);
    expect(result.refused).toHaveLength(1);
  });
});

describe("what earns its way through", () => {
  it("pins a faithful cross-clause dose fact with exact evidence offsets", () => {
    const result = verifyExtraction(NOTE, [fact({})]);
    expect(result.pinned).toHaveLength(1);
    const pinned = result.pinned[0];
    expect(NOTE.slice(pinned.start, pinned.end)).toBe("2 carp lido 2% w epi");
  });

  it("licensed shorthand grounds its expansion: 'lido' in the quote supports 'lidocaine'", () => {
    const result = verifyExtraction(NOTE, [fact({})]);
    expect(result.refused).toEqual([]);
  });

  it("marks parser agreement — the genuinely independent second reader", () => {
    const result = verifyExtraction(NOTE, [fact({})]);
    expect(result.pinned[0].parserAgrees).toBe(true);
  });

  it("tolerates whitespace differences in the quote and nothing else", () => {
    const spaced = NOTE.replace("2 carp lido", "2  carp   lido");
    const result = verifyExtraction(spaced, [fact({})]);
    expect(result.pinned).toHaveLength(1);
    expect(spaced.slice(result.pinned[0].start, result.pinned[0].end)).toMatch(/2\s+carp\s+lido/);
  });

  it("demotes low confidence to a question — a threshold routes to a human", () => {
    const result = verifyExtraction(NOTE, [fact({ confidence: "low" })]);
    expect(result.pinned).toEqual([]);
    expect(result.refused).toEqual([]);
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0]).toMatch(/confirm or correct/i);
  });
});

describe("shape validation refuses malformed batches whole", () => {
  it.each([
    [null, "not an object"],
    [{ facts: "nope" }, "facts is not an array"],
    [{ facts: [{ kind: "diagnosis", statement: "x", quote: "y", confidence: "high" }] }, "unknown fact kind"],
    [{ facts: [{ kind: "finding", statement: "", quote: "y", confidence: "high" }] }, "bad statement"],
    [{ facts: [{ kind: "finding", statement: "x", quote: "y", confidence: "certain" }] }, "bad confidence"]
  ])("refuses %j", (value, reason) => {
    const parsed = validateExtraction(value);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.reason).toBe(reason);
  });

  it("notably: 'diagnosis' is not an extractable kind, by design", () => {
    // Diagnosis is dentist judgement, reserved by scope-of-practice rules. A
    // model must not be able to propose one even as a suggestion — the kind
    // does not exist in the schema.
    const parsed = validateExtraction({
      facts: [{ kind: "diagnosis", statement: "irreversible pulpitis", quote: "perc +", confidence: "high" }]
    });
    expect(parsed.ok).toBe(false);
  });
});

describe("tolerance and determinism", () => {
  it.each(["", "   ", "\u0000", "#".repeat(100)])("never throws on input %j", (input) => {
    expect(() => verifyExtraction(input, [fact({})])).not.toThrow();
  });

  it("never throws on a hostile quote full of regex metacharacters", () => {
    expect(() =>
      verifyExtraction(NOTE, [fact({ quote: "((((*[a-z]+.*\\1$^" })])
    ).not.toThrow();
  });

  it("is deterministic across runs", () => {
    const facts = [fact({}), fact({ quote: "no swelling", statement: "swelling", kind: "finding" })];
    const once = JSON.stringify(verifyExtraction(NOTE, facts));
    expect(JSON.stringify(verifyExtraction(NOTE, facts))).toBe(once);
  });

  it("locateQuote finds nothing rather than something wrong", () => {
    expect(locateQuote("abc", "xyz")).toBeNull();
    expect(locateQuote("", "x")).toBeNull();
    expect(locateQuote("abc", "")).toBeNull();
  });
});
