import { describe, expect, it } from "vitest";
import { AI_NON_GOALS } from "./non-goals";
import { SYSTEM_PROMPTS, ASSIST_CAPABILITIES } from "./prompts";
import { getAssistConfig, runAssist, type GenerateFn } from "./service";

// An exclusion nothing enforces is a wish. These tests are what make the four
// stated non-goals more than a comment: each one checks that the capability is
// still absent, so re-introducing it fails here first and someone has to argue
// for it deliberately rather than adding it by accident.

describe("the non-goals are documented, not folklore", () => {
  it("states a conflict and an alternative for every one", () => {
    expect(AI_NON_GOALS.length).toBe(4);
    for (const goal of AI_NON_GOALS) {
      expect(goal.proposal.length, goal.id).toBeGreaterThan(40);
      expect(goal.conflict.length, goal.id).toBeGreaterThan(40);
      // The alternative matters most. A refusal with no route forward is how a
      // safety decision gets overridden by whoever is under pressure next.
      expect(goal.instead.length, goal.id).toBeGreaterThan(40);
    }
  });
});

describe("no capability reads a patient record, because there is none", () => {
  it("offers exactly four capabilities, none of them a history lookup", () => {
    expect([...ASSIST_CAPABILITIES]).toEqual(["normalize", "soap", "interrogate", "conflicts"]);
  });

  it("takes only note text — the signature has nowhere to put a patient", () => {
    // runAssist(capability, text, generate). Three parameters and no patient
    // context, which is the enforcement: a history cross-reference cannot be
    // added without changing this signature, and changing it is visible.
    expect(runAssist.length).toBe(3);
  });

  it("prompts no model to infer a diagnosis or a finding", () => {
    for (const capability of ASSIST_CAPABILITIES) {
      expect(SYSTEM_PROMPTS[capability], capability).toMatch(
        /NEVER infer a diagnosis, a radiographic interpretation, or a clinical finding/
      );
    }
  });
});

describe("no capability computes a dose", () => {
  it("forbids it in every prompt", () => {
    for (const capability of ASSIST_CAPABILITIES) {
      expect(SYSTEM_PROMPTS[capability], capability).toMatch(
        /NEVER compute or suggest a dose, a monitoring interval, or a billing code/
      );
    }
  });

  it("refuses a model that answers a dose question with a number", async () => {
    // The rails, not the prompt. A model that computes anyway is refused: the
    // number it invented is a digit the note never contained.
    const model: GenerateFn = async () => "Was the maximum dose of 7 mg/kg exceeded?";
    const out = await runAssist("interrogate", "Articaine administered for the lower left.", model);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.rejections?.some((r) => r.code === "digits-changed")).toBe(true);
  });
});

describe("no audio path exists", () => {
  it("accepts a string and nothing else", async () => {
    // The PHI gate reads text. If audio were ever accepted here it would bypass
    // the gate entirely, so the type is the boundary.
    const model: GenerateFn = async ({ prompt }) => prompt;
    const out = await runAssist("normalize", "Tooth 19 restored without complication.", model);
    expect(out.ok).toBe(true);
    // generate() is given a system prompt and a text prompt. No binary channel.
    const seen: string[] = [];
    const spy: GenerateFn = async ({ system, prompt }) => {
      seen.push(typeof system, typeof prompt);
      return prompt;
    };
    await runAssist("normalize", "Tooth 19 restored without complication.", spy);
    expect(seen).toEqual(["string", "string"]);
  });
});

describe("the verdict is binary, never a score", () => {
  it("returns a refusal with named reasons, not a confidence value", async () => {
    const model: GenerateFn = async () => "Amoxicillin 5000 mg three times daily for 7 days.";
    const out = await runAssist("normalize", "Amoxicillin 500 mg tid for 7 days.", model);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.rejections?.length).toBeGreaterThan(0);
      // Nothing in the outcome invites a judgement call about how sure the tool
      // is. It either passed or it did not.
      expect(Object.keys(out)).not.toContain("confidence");
      expect(Object.keys(out)).not.toContain("score");
    }
  });

  it("has no threshold to tune", () => {
    // A confidence model needs a cutoff, and a cutoff is a knob someone lowers
    // when the refusals get inconvenient. The config has two switches and a
    // model name.
    expect(Object.keys(getAssistConfig({})).sort()).toEqual(["enabled", "model"]);
  });
});

describe("AI stays opt-in per deployment", () => {
  it("is off with no configuration at all", () => {
    // The whole layer defaults to absent. Every guarantee above is moot if a
    // deployment can acquire an AI feature by upgrading.
    expect(getAssistConfig({}).enabled).toBe(false);
  });
});
