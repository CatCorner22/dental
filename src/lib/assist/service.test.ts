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

  it("blocks probable bare names even when they are only S2 for filing", async () => {
    let called = false;
    const spy: GenerateFn = async ({ prompt }) => {
      called = true;
      return prompt;
    };
    // Bare personal names are S2 REVIEW in the in-app audit, but an AI
    // provider is off-server — any phi category finding must stop the call.
    const out = await runAssist("normalize", "John Smith presented for recall today.", spy);
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

// ===========================================================================
// THE EXTRACT CAPABILITY, under adversarial models. The acceptance test, from
// the owner's blueprint: no AI-generated clinical fact without visible source
// evidence. These doubles are models that try to spend facts they never earned.
// ===========================================================================
describe("extract capability under adversarial models", () => {
  const NOTE = "Pt c/o pain UR quad. #3 perc +, no swelling. 2 carp lido 2% w epi. RCT #3 started.";
  const echo: GenerateFn = async () => "unused";
  const listOf =
    (facts: unknown): GenerateListFn =>
    async () => ({ facts });

  it("never calls the model when PHI is present — the gate is before the wire", async () => {
    let called = false;
    const spy: GenerateListFn = async () => {
      called = true;
      return { facts: [] };
    };
    const out = await runAssist("extract", "John Smith, #3 perc +.", echo, spy);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe("phi-blocked");
    expect(called).toBe(false);
  });

  it("a fabricating adversary gets every fact refused, and the call still succeeds", async () => {
    // Per-fact refusal inside an ok outcome IS the design: the human sees what
    // was refused and why, and the drift row gets the codes.
    const out = await runAssist(
      "extract",
      NOTE,
      echo,
      listOf([
        { kind: "medication", statement: "4 carpules of articaine", quote: "not in the note", confidence: "high" },
        { kind: "finding", statement: "swelling present", quote: "no swelling", confidence: "high" }
      ])
    );
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.extraction?.pinned).toEqual([]);
      expect(out.extraction?.refused).toHaveLength(2);
      expect(out.codes).toContain("extract.quote-not-found");
      expect(out.codes).toContain("extract.polarity-conflict");
    }
  });

  it("an honest model gets facts pinned with evidence offsets", async () => {
    const out = await runAssist(
      "extract",
      NOTE,
      echo,
      listOf([
        {
          kind: "medication",
          statement: "2 carpules of lidocaine 2% with epinephrine",
          quote: "2 carp lido 2% w epi",
          confidence: "high"
        }
      ])
    );
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.extraction?.pinned).toHaveLength(1);
      const pinned = out.extraction!.pinned[0];
      expect(NOTE.slice(pinned.start, pinned.end)).toBe("2 carp lido 2% w epi");
      expect(out.codes).toEqual([]);
    }
  });

  it("a shape-breaking adversary is a stated refusal, not a crash or a render", async () => {
    const out = await runAssist("extract", NOTE, echo, async () => ({ facts: "lots of them" }));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe("invalid-shape");
  });

  it("a diagnosis smuggled as a fact kind is refused at the shape", async () => {
    const out = await runAssist(
      "extract",
      NOTE,
      echo,
      listOf([{ kind: "diagnosis", statement: "irreversible pulpitis", quote: "perc +", confidence: "high" }])
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe("invalid-shape");
  });

  it("low confidence becomes a question for a human, never a fact", async () => {
    const out = await runAssist(
      "extract",
      NOTE,
      echo,
      listOf([
        { kind: "procedure", statement: "root canal therapy started on tooth 3", quote: "RCT #3 started", confidence: "low" }
      ])
    );
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.extraction?.pinned).toEqual([]);
      expect(out.extraction?.questions).toHaveLength(1);
    }
  });

  it("a missing structured binding is a stated model error", async () => {
    const out = await runAssist("extract", NOTE, echo, undefined);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe("model-error");
  });
});
