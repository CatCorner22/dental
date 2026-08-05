import { describe, expect, it } from "vitest";
import { runCompletenessRules } from "./completeness";

const ids = (text: string) => runCompletenessRules(text).map((f) => f.ruleId);

describe("imaging without interpretation", () => {
  it("fires when images were acquired and nothing says what they showed", () => {
    expect(ids("4 bitewing radiographs acquired. Prophylaxis completed.")).toContain(
      "complete.imaging-no-interpretation"
    );
  });

  it("stays silent when findings are recorded", () => {
    expect(
      ids("4 bitewing radiographs acquired. Interpretation by Dr. Lane: no significant findings.")
    ).not.toContain("complete.imaging-no-interpretation");
  });

  it("stays silent when the note only references existing images", () => {
    expect(ids("Reviewed prior radiographs with the patient.")).not.toContain(
      "complete.imaging-no-interpretation"
    );
  });
});

describe("anesthetic without amount", () => {
  it("fires on a named agent with no quantity", () => {
    expect(ids("Lidocaine with epinephrine administered; restoration completed on 19.")).toContain(
      "complete.anesthetic-no-amount"
    );
  });

  it("is satisfied by carpules or milligrams", () => {
    expect(ids("Lidocaine 2% with epinephrine, 2 carpules. Restoration completed.")).not.toContain(
      "complete.anesthetic-no-amount"
    );
    expect(ids("Articaine 68 mg infiltrated.")).not.toContain("complete.anesthetic-no-amount");
  });
});

describe("extraction without outcome", () => {
  it("fires on an extraction with no complications statement or post-op record", () => {
    expect(ids("Extraction of tooth 32 completed. Patient dismissed.")).toContain(
      "complete.extraction-no-outcome"
    );
  });

  it("is satisfied by an outcome and instructions", () => {
    expect(
      ids(
        "Extraction of tooth 32 completed without complication. Hemostasis observed. Post-operative instructions given verbally and in writing."
      )
    ).not.toContain("complete.extraction-no-outcome");
  });
});

describe("prescription without duration", () => {
  it("fires when a course has no length", () => {
    expect(ids("Prescribed amoxicillin 500 mg three times daily.")).toContain("complete.rx-no-duration");
  });

  it("is satisfied by a stated course", () => {
    expect(ids("Prescribed amoxicillin 500 mg three times daily for 7 days.")).not.toContain(
      "complete.rx-no-duration"
    );
  });
});

describe("consent without decision", () => {
  it("fires when a discussion has no decision", () => {
    expect(ids("Risks and benefits discussed for the proposed crown.")).toContain(
      "complete.consent-no-decision"
    );
  });

  it("is satisfied by the patient's decision", () => {
    expect(
      ids("Risks and benefits discussed for the proposed crown. Patient agreed and consent was recorded.")
    ).not.toContain("complete.consent-no-decision");
  });
});

describe("consent thin assertion", () => {
  it("fires when consent is asserted without conversation substance", () => {
    expect(ids("Patient consented. Crown prep on tooth 14 completed.")).toContain(
      "complete.consent-thin-assertion"
    );
    expect(ids("Consent was obtained. Extraction of tooth 32 completed.")).toContain(
      "complete.consent-thin-assertion"
    );
  });

  it("stays silent when risks or alternatives are recorded", () => {
    expect(
      ids(
        "Risks, benefits, and alternatives including no treatment discussed. Patient consented after questions."
      )
    ).not.toContain("complete.consent-thin-assertion");
  });

  it("does not double-fire when a full discussion-and-decision note is present", () => {
    const text =
      "Risks and benefits discussed for extraction. Patient declined antibiotics and consented to extraction.";
    expect(ids(text)).not.toContain("complete.consent-thin-assertion");
    expect(ids(text)).not.toContain("complete.consent-no-decision");
  });
});

describe("procedure without clinical rationale", () => {
  it("fires when a significant procedure has no documented reasoning", () => {
    expect(ids("Crown prep on tooth 14 completed. Patient tolerated well.")).toContain(
      "complete.clinical-rationale"
    );
    expect(ids("SRP UR quadrant completed.")).toContain("complete.clinical-rationale");
  });

  it("is satisfied by diagnosis or indication language", () => {
    expect(
      ids("Crown prep on tooth 14 due to recurrent decay under existing restoration. Patient tolerated well.")
    ).not.toContain("complete.clinical-rationale");
    expect(
      ids("SRP UR quadrant for generalized moderate chronic periodontitis. Patient tolerated well.")
    ).not.toContain("complete.clinical-rationale");
  });

  it("stays silent on hygiene-only visits", () => {
    expect(ids("Adult prophylaxis completed. Patient dismissed.")).not.toContain(
      "complete.clinical-rationale"
    );
  });
});

describe("tone", () => {
  it("every message anticipates the reader, never scolds the writer", () => {
    const findings = runCompletenessRules("Extraction of tooth 32 completed. Patient dismissed.");
    for (const f of findings) {
      expect(f.message).toMatch(/later reader|will ask/i);
      expect(f.message).not.toMatch(/you (forgot|failed|must)/i);
      expect(f.severity).toBe("S2");
    }
  });
});
