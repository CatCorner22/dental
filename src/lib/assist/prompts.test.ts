import { describe, expect, it } from "vitest";
import { NORMALIZE_EXAMPLES, SOAP_EXAMPLE, SYSTEM_PROMPTS } from "./prompts";
import { verifyMeaning } from "@/lib/verify/verifyMeaning";
import { runPhiRule } from "@/lib/audit/rules/phi";

// THE EXEMPLARS FACE THE SAME RAILS THE MODEL DOES.
//
// A worked example in a prompt is the strongest instruction the model
// receives — stronger than any rule, because imitation is cheaper than
// reasoning. So an exemplar that verifyMeaning would refuse teaches the model
// to produce refusals, at token cost, forever. This suite makes that class of
// bug impossible to ship: every example output must pass the exact gate the
// model's real output faces, and every example input must be as de-identified
// as the drafts it stands in for.

describe("normalize exemplars pass the meaning verifier", () => {
  for (const [i, ex] of NORMALIZE_EXAMPLES.entries()) {
    it(`example ${i + 1} is a faithful rewrite`, () => {
      const v = verifyMeaning(ex.input, ex.output, { mode: "rewrite" });
      expect(
        v.ok,
        v.ok ? "" : v.rejections.map((r) => `${r.code}: ${r.detail}`).join("; ")
      ).toBe(true);
    });
  }
});

describe("the SOAP exemplar passes the meaning verifier", () => {
  it("is a faithful restructuring", () => {
    const v = verifyMeaning(SOAP_EXAMPLE.input, SOAP_EXAMPLE.output, { mode: "rewrite" });
    expect(
      v.ok,
      v.ok ? "" : v.rejections.map((r) => `${r.code}: ${r.detail}`).join("; ")
    ).toBe(true);
  });

  it("demonstrates heading omission — no Assessment without a diagnosis", () => {
    expect(SOAP_EXAMPLE.output).not.toContain("Assessment");
  });
});

describe("exemplars are de-identified", () => {
  it("no exemplar trips the PHI gate", () => {
    for (const ex of [...NORMALIZE_EXAMPLES, SOAP_EXAMPLE]) {
      const phi = runPhiRule(`${ex.input}\n${ex.output}`).filter((f) => f.category === "phi");
      expect(phi, phi.map((f) => f.ruleId).join(", ")).toEqual([]);
    }
  });
});

describe("the prompts actually carry the exemplars", () => {
  it("normalize includes both worked examples", () => {
    for (const ex of NORMALIZE_EXAMPLES) {
      expect(SYSTEM_PROMPTS.normalize).toContain(ex.input);
      expect(SYSTEM_PROMPTS.normalize).toContain(ex.output);
    }
  });

  it("soap includes its worked example", () => {
    expect(SYSTEM_PROMPTS.soap).toContain(SOAP_EXAMPLE.input);
    expect(SYSTEM_PROMPTS.soap).toContain(SOAP_EXAMPLE.output);
  });
});
