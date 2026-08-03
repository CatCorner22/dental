import { describe, expect, it } from "vitest";
import {
  DRIFT_THRESHOLDS,
  decodeDriftDetail,
  driftVerdict,
  encodeDriftDetail,
  fabricationRate,
  summarize,
  type DriftEvent
} from "./drift";
import { runAssist, type GenerateFn } from "./service";

// "Learn over time" without training on anything.
//
// Every verifier refusal is a labelled example of the model misbehaving,
// produced free by a deterministic judge at the moment it happened. Counting them
// answers the only question that matters about a language model in production —
// is it getting worse — and it is the one question a single call cannot answer.

const at = new Date("2026-08-03T12:00:00Z");
const ev = (
  outcome: DriftEvent["outcome"],
  codes: string[] = [],
  model = "anthropic/claude-sonnet-4.5"
): DriftEvent => ({
  outcome,
  capability: "normalize",
  promptVersion: "1.2.0",
  model,
  codes,
  tokens: 0,
  at
});

describe("the wire format survives a round trip", () => {
  it("encodes and decodes an outcome with codes", () => {
    const e = {
      outcome: "verifier-rejected" as const,
      capability: "normalize",
      promptVersion: "1.2.0",
      model: "anthropic/claude-sonnet-4.5",
      tokens: 412,
      codes: ["content-invented", "site-changed"]
    };
    expect(decodeDriftDetail(encodeDriftDetail(e))).toEqual(e);
  });

  it("encodes and decodes an outcome with no codes", () => {
    const e = {
      outcome: "ok" as const,
      capability: "soap",
      promptVersion: "1.2.0",
      model: "openai/gpt-5",
      tokens: 0,
      codes: []
    };
    expect(decodeDriftDetail(encodeDriftDetail(e))).toEqual(e);
  });

  it("refuses to read a row that is not a drift row", () => {
    // The audit log carries many other actions. Reading one of those as drift
    // would silently poison every rate on the page.
    expect(decodeDriftDetail("normalize v1.0.0 [terminology]")).toBeNull();
    expect(decodeDriftDetail("")).toBeNull();
    expect(decodeDriftDetail("nonsense cap=x prompt=y model=z")).toBeNull();
  });
});

describe("what the window counts", () => {
  it("separates the four outcomes", () => {
    const w = summarize([
      ev("ok"),
      ev("ok"),
      ev("verifier-rejected", ["digits-changed"]),
      ev("phi-blocked", ["phi.date"]),
      ev("model-error")
    ]);
    expect(w).toMatchObject({ accepted: 2, refused: 1, phiBlocked: 1, errors: 1 });
  });

  it("excludes PHI blocks from the refusal rate", () => {
    // A PHI block is a fact about what staff typed, not about how the model
    // behaved. Folding it in would move the number that is supposed to mean "the
    // model is drifting" every time somebody pastes a phone number.
    const w = summarize([ev("ok"), ev("verifier-rejected", ["digits-changed"]), ev("phi-blocked", ["phi.phone"])]);
    expect(w.refusalRate).toBe(0.5); // 1 refused of 2 answered, not of 3
  });

  it("counts codes most-frequent-first, with a stable tiebreak", () => {
    const w = summarize([
      ev("verifier-rejected", ["content-invented"]),
      ev("verifier-rejected", ["content-invented"]),
      ev("verifier-rejected", ["site-changed"]),
      ev("verifier-rejected", ["attribution-added"])
    ]);
    expect(w.byCode).toEqual([
      { code: "content-invented", count: 2 },
      { code: "attribution-added", count: 1 },
      { code: "site-changed", count: 1 }
    ]);
  });

  it("attributes refusals to the model that produced them", () => {
    // The load-bearing field. A version name is a pointer, and the thing behind
    // it changes without notice; a rise in refusals is unattributable without it.
    const w = summarize([
      ev("ok", [], "model-a"),
      ev("ok", [], "model-a"),
      ev("verifier-rejected", ["content-invented"], "model-b"),
      ev("verifier-rejected", ["content-invented"], "model-b")
    ]);
    expect(w.byModel).toEqual([
      { model: "model-a", answered: 2, refused: 0, refusalRate: 0 },
      { model: "model-b", answered: 2, refused: 2, refusalRate: 1 }
    ]);
  });

  it("reports zero rather than NaN on an empty window", () => {
    const w = summarize([]);
    expect(w.refusalRate).toBe(0);
    expect(fabricationRate(w)).toBe(0);
  });
});

describe("fabrication is held to a tighter bar than garbling", () => {
  it("counts only the codes that mean the model asserted something", () => {
    // digits-changed is a transcription-shaped failure. content-invented is the
    // model claiming things nobody said, which is the one that ends up in front
    // of a plaintiff's expert.
    const w = summarize([
      ev("ok"),
      ev("verifier-rejected", ["digits-changed"]),
      ev("verifier-rejected", ["content-invented"])
    ]);
    expect(w.refusalRate).toBeCloseTo(0.667, 2);
    expect(fabricationRate(w)).toBeCloseTo(0.333, 2);
  });
});

describe("the verdict is a stated rule a person can disagree with", () => {
  it("stays quiet on too small a sample", () => {
    const v = driftVerdict(summarize([ev("verifier-rejected", ["content-invented"])]));
    expect(v.level).toBe("quiet");
    expect(v.reason).toMatch(/too few/);
  });

  it("escalates to investigate when fabrication crosses its bar", () => {
    const events = [
      ...Array.from({ length: 40 }, () => ev("ok")),
      ...Array.from({ length: 5 }, () => ev("verifier-rejected", ["content-invented"]))
    ];
    const v = driftVerdict(summarize(events));
    expect(v.level).toBe("investigate");
    // It must say the rails held, or a reader concludes something reached a chart.
    expect(v.reason).toMatch(/caught every one/i);
    expect(v.reason).toMatch(/model/i);
  });

  it("says watch, not investigate, when refusals are merely wasteful", () => {
    // Nothing unsafe happened; staff are burning clicks on drafts they never see.
    // That is a usefulness problem, and calling it a safety problem trains people
    // to ignore the safety word.
    const events = [
      ...Array.from({ length: 20 }, () => ev("ok")),
      ...Array.from({ length: 10 }, () => ev("verifier-rejected", ["digits-changed"]))
    ];
    const v = driftVerdict(summarize(events));
    expect(v.level).toBe("watch");
    expect(v.reason).toMatch(/Nothing unsafe/i);
  });

  it("stays quiet on a healthy window", () => {
    const events = [
      ...Array.from({ length: 48 }, () => ev("ok")),
      ...Array.from({ length: 2 }, () => ev("verifier-rejected", ["digits-changed"]))
    ];
    expect(driftVerdict(summarize(events)).level).toBe("quiet");
  });

  it("keeps its thresholds readable rather than buried", () => {
    // The contract is human-reviewed and never self-adjusting, so the numbers
    // have to be somewhere a person can find and argue with.
    expect(DRIFT_THRESHOLDS.fabricationRate).toBeLessThan(DRIFT_THRESHOLDS.refusalRate);
    expect(DRIFT_THRESHOLDS.minimumSample).toBeGreaterThan(0);
  });
});

describe("the privacy contract is not relaxed to get the signal", () => {
  it("puts no note text in a drift row, on any failure path", async () => {
    const secret = "Patient Jonathan Q Featherstonehaugh, DOB 03/14/1980, phone 615-555-1234";
    const out = await runAssist("normalize", secret, async () => "irrelevant");
    expect(out.ok).toBe(false);
    if (out.ok) return;
    const detail = encodeDriftDetail({
      outcome: out.code,
      capability: "normalize",
      promptVersion: "1.2.0",
      model: "anthropic/claude-sonnet-4.5",
      tokens: 0,
      codes: out.codes
    });
    // The codes ARE present — that is the signal, and rule ids are constants.
    expect(out.codes.length).toBeGreaterThan(0);
    expect(detail).toMatch(/phi\./);
    // And nothing the writer typed is anywhere in the row.
    for (const fragment of ["Featherstonehaugh", "Jonathan", "1980", "615", "555", "1234", "03/14"]) {
      expect(detail, fragment).not.toContain(fragment);
    }
  });

  it("carries the rejection codes for a verifier refusal, and no draft text", async () => {
    const model: GenerateFn = async () =>
      "Extraction of tooth 17 completed. Risks and alternatives were discussed and consent was obtained.";
    const out = await runAssist("normalize", "Extraction of tooth 17 completed.", model);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.codes).toContain("content-invented");
    const detail = encodeDriftDetail({
      outcome: out.code,
      capability: "normalize",
      promptVersion: "1.2.0",
      model: "m",
      tokens: 0,
      codes: out.codes
    });
    expect(detail).not.toMatch(/consent|alternatives|extraction/i);
  });
});
