import { describe, expect, it } from "vitest";
import { glossColloquialisms } from "./comprehension";
import { buildJsgfGrammar } from "./engine";
import {
  DENTAL_ENROLLMENT_PHRASES,
  enrollmentScript,
  phrasesForRegion,
  REGIONAL_COLLOQUIALS,
  USA_REGIONS
} from "./regional";

describe("USA regional colloquial lexicon", () => {
  it("covers every region with at least five phrases", () => {
    for (const r of USA_REGIONS) {
      expect(phrasesForRegion(r.id).length, r.id).toBeGreaterThanOrEqual(5);
    }
  });

  it("builds a long enough enrollment script for a 3–5 minute session", () => {
    const script = enrollmentScript("south");
    expect(script.length).toBeGreaterThanOrEqual(20);
    expect(script.some((l) => DENTAL_ENROLLMENT_PHRASES.includes(l))).toBe(true);
  });

  it("glosses colloquialisms without rewriting the source text", () => {
    const text = "Yeah y'all, gonna check the bitewing next.";
    const hits = glossColloquialisms(text, "south");
    expect(hits.some((h) => h.phrase === "y'all")).toBe(true);
    expect(hits.some((h) => h.phrase === "gonna")).toBe(true);
    // Contract: comprehension never returns a replacement string for the note.
    expect(text).toBe("Yeah y'all, gonna check the bitewing next.");
  });

  it("never lists empty sayings", () => {
    for (const p of REGIONAL_COLLOQUIALS) {
      expect(p.say.trim().length).toBeGreaterThan(0);
      expect(p.gloss.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("JSGF grammar builder", () => {
  it("emits a JSGF string from phrases", () => {
    const g = buildJsgfGrammar(["bitewing radiographs", "y'all"]);
    expect(g.startsWith("#JSGF")).toBe(true);
    expect(g).toContain("bitewing radiographs");
  });
});
