import { describe, expect, it } from "vitest";
import { getAssistConfig, runAssist, type GenerateFn, type GenerateListFn } from "./service";

// The service is tested with adversarial models: every test binds a fake
// generate() that misbehaves in a specific way, and the service must refuse.

const echo: GenerateFn = async ({ prompt }) => prompt;

describe("config", () => {
  it("is off unless BOTH the flag and the key are present", () => {
    expect(getAssistConfig({}).enabled).toBe(false);
    expect(getAssistConfig({ ASSIST_ENABLED: "1" }).enabled).toBe(false);
    expect(getAssistConfig({ AI_GATEWAY_API_KEY: "k" }).enabled).toBe(false);
    expect(getAssistConfig({ ASSIST_ENABLED: "1", AI_GATEWAY_API_KEY: "k" }).enabled).toBe(true);
  });

  it("has a default model and honors the override", () => {
    expect(getAssistConfig({}).model).toBeTruthy();
    expect(getAssistConfig({ ASSIST_MODEL: "openai/gpt-5" }).model).toBe("openai/gpt-5");
  });
});

describe("PHI gate", () => {
  it("blocks the call before the model ever sees the text", async () => {
    let called = false;
    const spy: GenerateFn = async ({ prompt }) => {
      called = true;
      return prompt;
    };
    const out = await runAssist(
      "normalize",
      "Patient John Smithson, DOB 01/02/1990, phone 865-555-0100, presented for exam.",
      spy
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe("phi-blocked");
    expect(called).toBe(false);
  });
});

describe("verifier gate on rewrites", () => {
  it("accepts a faithful rewording", async () => {
    const model: GenerateFn = async () =>
      "The patient reports pain lasting 3 days. Tooth 19 was restored with 2 carpules of anesthetic.";
    const out = await runAssist(
      "normalize",
      "pt reports pain x3 days. tooth 19 restored, 2 carpules used for the anesthetic.",
      model
    );
    expect(out.ok).toBe(true);
  });

  it("refuses a model that changed a dose", async () => {
    const model: GenerateFn = async () => "Amoxicillin 5000 mg three times daily for 7 days.";
    const out = await runAssist("normalize", "Amoxicillin 500 mg tid for 7 days.", model);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.code).toBe("verifier-rejected");
      expect(out.rejections?.some((r) => r.code === "digits-changed")).toBe(true);
      expect(out.message).toMatch(/refused|check/i);
    }
  });

  it("refuses a model that dropped a negation", async () => {
    const model: GenerateFn = async () => "Bleeding was observed. Patient discharged.";
    const out = await runAssist("normalize", "No bleeding was observed. Patient discharged.", model);
    expect(out.ok).toBe(false);
  });

  it("refuses a model that swapped a drug", async () => {
    const model: GenerateFn = async () => "Prescribed metronidazole 500 mg.";
    const out = await runAssist("normalize", "Prescribed amoxicillin 500 mg.", model);
    expect(out.ok).toBe(false);
  });

  it("refuses a model that promoted a patient report to a fact", async () => {
    const model: GenerateFn = async () => "Pain present for three days.";
    const out = await runAssist("normalize", "Patient reports pain for three days.", model);
    expect(out.ok).toBe(false);
  });
});

describe("verifier gate on question capabilities", () => {
  // The list capabilities now go through a schema, so the double lies in
  // OBJECT shape rather than in prose. Everything these tests assert about the
  // rails is unchanged; only the seam the adversary attacks has moved.
  const never: GenerateFn = async () => {
    throw new Error("the text seam must not be used for a list capability");
  };
  const list = (value: unknown): GenerateListFn => async () => value;

  it("accepts a pure question list", async () => {
    const out = await runAssist(
      "interrogate",
      "RCT completed on tooth 19.",
      never,
      list({
        questions: [
          "Was the consent conversation documented?",
          "Which anesthetic and amount were used?"
        ]
      })
    );
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.items).toHaveLength(2);
  });

  it("refuses a question list that asserts", async () => {
    const out = await runAssist(
      "interrogate",
      "RCT completed on tooth 19.",
      never,
      list({
        questions: [
          "Was consent documented?",
          "The patient has irreversible pulpitis and needs immediate treatment."
        ]
      })
    );
    expect(out.ok).toBe(false);
    // Caught by the shape validator now, one layer earlier than the verifier.
    if (!out.ok) expect(out.code).toBe("invalid-shape");
  });

  it("refuses a question that plants a number", async () => {
    const out = await runAssist(
      "conflicts",
      "Amoxicillin prescribed for the abscess.",
      never,
      list({
        conflicts: [
          { first: "Amoxicillin prescribed", second: "the dose was 500 mg", why: "Was the dose 500 mg?" }
        ]
      })
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe("verifier-rejected");
  });

  it("refuses a payload of the wrong shape outright", async () => {
    const out = await runAssist(
      "interrogate",
      "RCT completed on tooth 19.",
      never,
      list({ questions: "not an array" })
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe("invalid-shape");
  });

  it("refuses a conflict between a statement and itself", async () => {
    // A schema-valid way to look useful while saying nothing. A clinician sent
    // to find this contradiction would find nothing there.
    const out = await runAssist(
      "conflicts",
      "The patient reports pain.",
      never,
      list({ conflicts: [{ first: "pain reported", second: "Pain Reported", why: "these differ" }] })
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe("invalid-shape");
  });

  it("says so plainly when the structured binding is missing", async () => {
    const out = await runAssist("interrogate", "RCT completed on tooth 19.", never);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe("model-error");
  });
});

describe("model failure", () => {
  it("degrades gracefully with a stated fallback", async () => {
    const model: GenerateFn = async () => {
      throw new Error("provider down");
    };
    const out = await runAssist("normalize", "Tooth 19 restored without complication.", model);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.code).toBe("model-error");
      expect(out.message).toMatch(/deterministic|without/i);
    }
  });
});

describe("echo model", () => {
  it("an unchanged note passes verification", async () => {
    const out = await runAssist("normalize", "Tooth 19 restored. No complications observed.", echo);
    expect(out.ok).toBe(true);
  });
});
