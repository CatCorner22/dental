import { describe, expect, it } from "vitest";
import { extractFacts, coverage } from "./extract";
import { affirmedSites } from "./facts";
import type { ProcedureFact } from "./facts";

const procedures = (text: string): ProcedureFact[] =>
  extractFacts(text).facts.filter((f): f is ProcedureFact => f.kind === "procedure");

const teeth = (text: string): string[] => affirmedSites(extractFacts(text)).map((s) => s.toothId).sort();

describe("the thing this must never do: invent a tooth", () => {
  // Rule 1. Every one of these is a number in tooth range with no introducer.
  it.each([
    ["2 carpules lidocaine administered", "carpule count"],
    ["probing depths 3 mm generalized", "millimetres"],
    ["patient is 14 years old", "an age"],
    ["blood pressure 120 over 80", "vitals"],
    ["recall in 6 months", "an interval"],
    ["4 bitewings taken", "a radiograph count"],
    ["shade A2 selected, 3 increments placed", "an increment count"]
  ])("does not read a tooth out of %j (%s)", (text) => {
    expect(teeth(text)).toEqual([]);
  });

  // Rule 2. An introducer is present but the noun in front disqualifies it.
  it.each([
    "lot #4432 expired",
    "Op #2 turnover complete",
    "chair #3 requires service",
    "claim #17 resubmitted",
    "shade #14 selected"
  ])("does not read a tooth out of %j", (text) => {
    expect(teeth(text)).toEqual([]);
  });

  it("does not treat bare 'no' as a tooth introducer", () => {
    // "no 14" must stay negation, never "tooth 14".
    expect(teeth("no 14 caries")).toEqual([]);
  });
});

describe("the thing this must never do: assert what the note denied", () => {
  it("negates a finding the note explicitly cleared", () => {
    const result = extractFacts("No caries #14.");
    const site = result.facts.find((f) => f.kind === "tooth-site");
    expect(site?.assertion.polarity).toBe("negated");
    // And therefore the chart stays blank.
    expect(affirmedSites(result)).toEqual([]);
  });

  it("carries negation across a conjunction", () => {
    const result = extractFacts("No caries #14 and #15.");
    expect(result.facts.every((f) => f.assertion.polarity === "negated")).toBe(true);
  });

  it("stops negation at a terminator", () => {
    const result = extractFacts("No caries #14 but composite #30 MOD placed");
    const proc = procedures("No caries #14 but composite #30 MOD placed")[0];
    expect(proc.assertion.polarity).toBe("affirmed");
    expect(result.facts.length).toBeGreaterThan(0);
  });

  it("is not fooled by a pseudo-trigger", () => {
    // "no change" contains "no" and denies nothing.
    const result = extractFacts("No change, composite #14 MOD placed");
    expect(procedures("No change, composite #14 MOD placed")[0].assertion.polarity).toBe("affirmed");
    expect(result.facts.length).toBeGreaterThan(0);
  });

  it("does not negate a concept behind a definite article", () => {
    // The published ConText error: "has not been on steroids for HIS asthma"
    // negated the asthma. A definite article marks a known existing thing being
    // referred to, not a finding being denied.
    const result = extractFacts("Not treated today for the crown #3");
    expect(result.facts[0]?.assertion.polarity).toBe("affirmed");
  });

  // THE BUG THIS PINS. Negation scope runs to the end of the clause, and until
  // clauseRanges split on commas the whole note was one clause -- so a single
  // "no" at the front denied every procedure after it. A note reading "no
  // caries #14, composite #30 MOD placed" reported the composite as not done.
  it("does not leak negation across a comma into the next assertion", () => {
    const note = "No caries #14, composite #30 MOD placed";
    const denied = extractFacts(note).facts.find(
      (f) => f.kind === "tooth-site" && f.site.toothId === "14"
    );
    const done = extractFacts(note).facts.find((f) => f.kind === "procedure");
    expect(denied?.assertion.polarity).toBe("negated");
    expect(done?.assertion.polarity).toBe("affirmed");
    expect(affirmedSites(extractFacts(note)).map((s) => s.toothId)).toEqual(["30"]);
  });

  it("reads a backward negation, which is how an exam is actually written", () => {
    const result = extractFacts("Caries #14 not present");
    expect(result.facts[0]?.assertion.polarity).toBe("negated");
  });
});

describe("temporality is hinted, never assigned", () => {
  it("flags an existing restoration rather than silently classing it", () => {
    const result = extractFacts("Existing amalgam #14 MOD");
    const fact = result.facts[0];
    expect(fact.assertion.temporalityHint).toBe("historical");
    // Crucially still affirmed: the tooth DOES have an amalgam.
    expect(fact.assertion.polarity).toBe("affirmed");
  });

  it("flags a conditional plan as hypothetical", () => {
    const result = extractFacts("Will need crown #14 if fracture propagates");
    expect(result.facts[0]?.assertion.temporalityHint).toBe("hypothetical");
  });

  it("limits the scope of 'previous' to one term, per the published rule", () => {
    const result = extractFacts("Previous extraction #1, composite #14 MOD placed today");
    const comp = result.facts.find((f) => f.kind === "procedure" && f.procedure === "composite restoration");
    expect(comp?.assertion.temporalityHint).toBeUndefined();
  });
});

describe("tooth and surface notation", () => {
  it("reads a hash tooth with surfaces", () => {
    const [proc] = procedures("#14 MOD composite placed");
    expect(proc.procedure).toBe("composite restoration");
    expect(proc.sites).toHaveLength(1);
    expect(proc.sites[0].toothId).toBe("14");
    expect(proc.sites[0].surfaces).toEqual(["M", "O", "D"]);
  });

  it("reads a comma list without splitting the clause", () => {
    expect(teeth("#3, 14, 30 sealants placed")).toEqual(["14", "3", "30"]);
  });

  it("expands an inclusive range", () => {
    expect(teeth("#2-5 scaling and root planing")).toEqual(["2", "3", "4", "5"]);
  });

  it("reads primary letters", () => {
    expect(teeth("#T pulpotomy")).toEqual(["T"]);
  });

  it("records an anatomically impossible surface instead of dropping it", () => {
    // Tooth 8 is a central incisor: it has no occlusal or buccal surface.
    const [proc] = procedures("#8 MOB composite");
    expect(proc.sites[0].impossibleSurfaces).toContain("O");
    expect(proc.sites[0].impossibleSurfaces).toContain("B");
    expect(proc.sites[0].surfaces).toEqual(["M"]);
  });

  it("refuses lowercase surface letters (rule 3)", () => {
    // "do" is a word before it is distal-occlusal.
    const [proc] = procedures("#14 do composite");
    expect(proc.sites[0].surfaces).toEqual([]);
  });

  it("refuses a repeated letter, which is not notation", () => {
    const [proc] = procedures("#14 MMO composite");
    expect(proc.sites[0].surfaces).toEqual([]);
  });

  it("refuses a single letter as a surface", () => {
    const [proc] = procedures("#14 D composite");
    expect(proc.sites[0].surfaces).toEqual([]);
  });

  it("handles fullwidth digits without shifting spans", () => {
    const text = "#１４ MOD composite";
    const [proc] = procedures(text);
    expect(proc.sites[0].toothId).toBe("14");
    expect(text.slice(proc.sites[0].span.start, proc.sites[0].span.end)).toContain("１４");
  });
});

describe("procedure recognition", () => {
  it("prefers the longest match", () => {
    expect(procedures("surgical extraction #17")[0].procedure).toBe("surgical extraction");
    expect(procedures("root canal therapy #3")[0].procedure).toBe("root canal therapy");
  });

  it("assigns categories that a contradiction rule can reason over", () => {
    expect(procedures("#17 ext")[0].category).toBe("surgical");
    expect(procedures("#14 MOD comp")[0].category).toBe("restorative");
  });

  it("does not resolve deliberately ambiguous shorthand", () => {
    // FMX is full-mouth series and full-mouth extraction. Guessing is the one
    // thing that would make this dangerous.
    expect(procedures("FMX taken")).toEqual([]);
    expect(procedures("CR placed #14")).toEqual([]);
    expect(procedures("GP removed")).toEqual([]);
  });
});

describe("clause scoping", () => {
  it("keeps a real shorthand note's assertions in separate boxes", () => {
    const note = "#14 MOD comp, 2 carp lido, rubber dam, pt tol well";
    const result = extractFacts(note);
    const comp = result.facts.find((f) => f.kind === "procedure");
    expect(comp).toBeDefined();
    // The carpule count must not become a tooth in the neighbouring clause.
    expect(teeth(note)).toEqual(["14"]);
  });

  it("one unparseable clause does not cost the others", () => {
    const result = extractFacts("qqq zzz wibble, #14 MOD composite placed");
    expect(result.facts.length).toBeGreaterThan(0);
    expect(result.unparsed).toHaveLength(1);
  });
});

describe("total input tolerance", () => {
  it.each([
    "",
    "   ",
    "\u0000\u0001\u0002",
    "###",
    "#",
    "#99",
    "#0",
    "tooth",
    "#-",
    "#,,,,",
    "-".repeat(500),
    "#".repeat(500)
  ])("never throws on %j", (text) => {
    expect(() => extractFacts(text)).not.toThrow();
  });

  it("is deterministic across repeated runs", () => {
    const note = "#3, 14, 30 MOD composite placed, no caries #18, existing crown #19";
    const once = JSON.stringify(extractFacts(note));
    expect(JSON.stringify(extractFacts(note))).toBe(once);
    expect(JSON.stringify(extractFacts(note))).toBe(once);
  });

  it("stays fast on a long note", () => {
    const note = "#14 MOD composite placed, no caries #18. ".repeat(400);
    const started = performance.now();
    extractFacts(note);
    expect(performance.now() - started).toBeLessThan(500);
  });
});

describe("coverage is an honest denominator", () => {
  it("counts clauses we did not understand against us", () => {
    const result = extractFacts("#14 MOD composite. Patient tolerated the visit without difficulty.");
    expect(coverage(result)).toBeLessThan(1);
    expect(coverage(result)).toBeGreaterThan(0);
  });

  it("is zero on an empty note rather than one", () => {
    expect(coverage(extractFacts(""))).toBe(0);
  });
});

describe("spans point back at the original text", () => {
  it("every fact span selects the words that produced it", () => {
    const note = "Composite #14 MOD placed today";
    for (const fact of extractFacts(note).facts) {
      const selected = note.slice(fact.span.start, fact.span.end);
      expect(selected.length).toBeGreaterThan(0);
      expect(note).toContain(selected);
    }
  });
});
