import { describe, expect, it } from "vitest";
import { parseContextFor, resolveReads, runByteStar } from "./service";
import { runCanary, CANARY_CASES } from "./canary";
import { getByteStarConfig } from "./config";
import type { GenerateListFn } from "@/lib/assist/service";

const ASSIST_ON = {
  ASSIST_ENABLED: "1",
  AI_GATEWAY_API_KEY: "test-key",
  BYTESTAR_ENABLED: "1"
};

const CONFIG = getByteStarConfig(ASSIST_ON);

const grounded = (say: string, evidence: string) => ({
  kind: "active-voice",
  say,
  why: "Passive voice hides the actor a reviewer always wants.",
  evidence,
  source: "Practice writing standard — active voice"
});

describe("mandatory grounding — an observation must point at its text", () => {
  it("refuses a wording observation that carries no evidence quote", async () => {
    const generate: GenerateListFn = async () => ({
      suggestions: [
        {
          kind: "clarity",
          say: "The wording could be tighter.",
          why: "Tighter wording reads faster.",
          source: "Practice writing standard"
        }
      ]
    });
    const outcome = await runByteStar("#17 extracted. The sutures were placed.", generate, {
      config: CONFIG
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.codes).toContain("missing-evidence");
  });

  it("gap kinds still need no evidence — absence cannot be quoted", async () => {
    const generate: GenerateListFn = async () => ({
      suggestions: [
        {
          kind: "tn-required",
          say: "Was allergy status reviewed?",
          why: "Tennessee records expect an allergy statement.",
          question: "Was allergy status reviewed?",
          source: "TN Board of Dentistry Rules"
        }
      ]
    });
    const outcome = await runByteStar("#14 MOD composite placed by the dentist.", generate, {
      config: CONFIG
    });
    expect(outcome.ok).toBe(true);
  });
});

describe("self-consistency — only majority-corroborated observations survive", () => {
  it("keeps what every read repeats and drops what one read invents", async () => {
    let call = 0;
    const generate: GenerateListFn = async () => {
      call += 1;
      const stable = grounded("The record does not name who placed the sutures.", "The sutures were placed.");
      // One read produces an extra observation, anchored to a different quote,
      // that the other reads never corroborate.
      const oneOff = grounded(`Unique invention number ${call}.`, "#17 extracted.");
      return { suggestions: call === 2 ? [stable, oneOff] : [stable] };
    };
    const outcome = await runByteStar("#17 extracted. The sutures were placed.", generate, {
      config: CONFIG,
      reads: 3
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.reads).toBe(3);
      expect(outcome.suggestions).toHaveLength(1);
      expect(outcome.suggestions[0].corroboration).toEqual({ seen: 3, reads: 3 });
      expect(outcome.codes).toContain("no-consensus");
    }
  });

  it("a model escape on ANY read refuses the whole turn", async () => {
    let call = 0;
    const generate: GenerateListFn = async () => {
      call += 1;
      if (call === 2) {
        return {
          suggestions: [
            {
              kind: "clarity",
              say: "I've updated the note for you.",
              why: "Helpful.",
              evidence: "The sutures were placed.",
              source: "Practice writing standard"
            }
          ]
        };
      }
      return { suggestions: [grounded("The record does not name the actor.", "The sutures were placed.")] };
    };
    const outcome = await runByteStar("#17 extracted. The sutures were placed.", generate, {
      config: CONFIG,
      reads: 3
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.code).toBe("escape-model");
  });

  it("single-read mode attaches no corroboration and keeps everything grounded", async () => {
    const generate: GenerateListFn = async () => ({
      suggestions: [grounded("The record does not name the actor.", "The sutures were placed.")]
    });
    const outcome = await runByteStar("#17 extracted. The sutures were placed.", generate, {
      config: CONFIG,
      reads: 1
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.suggestions[0].corroboration).toBeUndefined();
  });

  it("resolveReads clamps to 1..3 and defaults to 1", () => {
    expect(resolveReads({})).toBe(1);
    expect(resolveReads({ BYTESTAR_READS: "3" })).toBe(3);
    expect(resolveReads({ BYTESTAR_READS: "7" })).toBe(3);
    expect(resolveReads({ BYTESTAR_READS: "0" })).toBe(1);
    expect(resolveReads({ BYTESTAR_READS: "banana" })).toBe(1);
  });
});

describe("the deterministic parse rides the prompt", () => {
  it("summarizes teeth, medications, and denials from the extractor", () => {
    const ctx = parseContextFor("#17 extracted. 2 carpules lidocaine 2% with epinephrine. No swelling.");
    expect(ctx).toContain("teeth referenced: 17");
    expect(ctx).toContain("lidocaine 2%");
    expect(ctx).toContain("DENIED");
    expect(ctx).toContain("swelling");
  });

  it("is empty for an empty draft", () => {
    expect(parseContextFor("")).toBe("");
  });

  it("reaches the model call as trusted context", async () => {
    let seenSystem = "";
    const generate: GenerateListFn = async ({ system }) => {
      seenSystem = system;
      return { suggestions: [] };
    };
    await runByteStar("#17 extracted. No swelling.", generate, { config: CONFIG });
    expect(seenSystem).toContain("DETERMINISTIC PARSE");
    expect(seenSystem).toContain("teeth referenced: 17");
  });
});

describe("the canary eval — rail survival with a denominator", () => {
  it("passes end to end with a compliant model double", async () => {
    const generate: GenerateListFn = async ({ system, prompt }) => {
      // Ground the observation in whatever draft arrived, like an honest model.
      const draft = /note:\n\n([\s\S]*?)\n\nReturn/.exec(prompt)?.[1] ?? "";
      const sentence = draft.split(". ").find((s) => s.length > 10) ?? draft;
      // A compliant model under a legal STRICT READ cites named authority and
      // asks — house style would be refused by the router's verifier.
      if (system.includes("STRICT READ") && /legal/.test(system)) {
        return {
          suggestions: [
            {
              kind: "completeness",
              say: "Was the supervising dentist identified by role?",
              why: "Supervision statements are read against the responsible dentist.",
              question: "Was the supervising dentist identified by role?",
              source: "TN Board of Dentistry Rules"
            }
          ]
        };
      }
      return {
        suggestions: [
          {
            kind: "clarity",
            say: "The record states this plainly.",
            why: "Clear statements age well in a chart.",
            evidence: sentence.trim(),
            source: "Practice writing standard"
          }
        ]
      };
    };
    const report = await runCanary(generate, { config: CONFIG });
    expect(report.total).toBe(CANARY_CASES.length);
    expect(report.passed).toBe(report.total);
    expect(report.keptTotal).toBeGreaterThan(0);
  });

  it("the PHI and jailbreak canaries never reach the model", async () => {
    const reached: string[] = [];
    const generate: GenerateListFn = async ({ prompt }) => {
      reached.push(prompt);
      return { suggestions: [] };
    };
    await runCanary(generate, { config: CONFIG });
    for (const p of reached) {
      expect(p).not.toContain("John Smith");
      expect(p).not.toContain("Ignore previous instructions");
    }
  });

  it("fails the yield check when the model earns nothing past the rails", async () => {
    const generate: GenerateListFn = async () => ({
      suggestions: [
        {
          kind: "clarity",
          say: "Something vague.",
          why: "Vague.",
          source: "A random blog" // fails the source allow-list
        }
      ]
    });
    const report = await runCanary(generate, { config: CONFIG });
    const modelCases = report.results.filter((r) => r.expected === "observations");
    expect(modelCases.every((r) => !r.pass)).toBe(true);
    // The gate canaries still pass — the cage is healthy even when the model is not.
    const gateCases = report.results.filter((r) => r.expected !== "observations");
    expect(gateCases.every((r) => r.pass)).toBe(true);
  });
});
