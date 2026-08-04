import { describe, expect, it } from "vitest";
import { retrieveContext } from "./retrieval";
import { runAssist, type GenerateFn } from "./service";

describe("retrieveContext", () => {
  it("selects terminology only for tokens the text actually contains", () => {
    const r = retrieveContext("RCT started on tooth 19.");
    expect(r.sources).toContain("practice terminology");
    expect(r.text).toContain("root canal therapy");
    // A term the text never mentions must not be stuffed into the prompt.
    expect(r.text).not.toContain("bitewing radiograph");
  });

  it("marks ambiguous shorthand as never-expand", () => {
    const r = retrieveContext("FMS noted in the medical history.");
    expect(r.text).toMatch(/AMBIGUOUS/);
    expect(r.text).toMatch(/fibromyalgia/i);
  });

  it("includes the sedation checklist only for sedation text", () => {
    expect(retrieveContext("IV moderate sedation planned.").sources).toContain(
      "sedation record elements"
    );
    expect(retrieveContext("Routine prophylaxis completed.").sources).not.toContain(
      "sedation record elements"
    );
  });

  it("includes tooth-notation rules when teeth are referenced", () => {
    expect(retrieveContext("Composite on tooth 19.").sources).toContain("tooth notation");
  });

  it("includes consent rules for consent discussions", () => {
    expect(retrieveContext("Risks and benefits discussed.").sources).toContain(
      "consent documentation"
    );
  });

  it("includes informed-refusal rules when a recommendation is declined", () => {
    expect(retrieveContext("Patient refused the recommended crown.").sources).toContain(
      "informed refusal"
    );
    expect(retrieveContext("Patient declined fluoride.").sources).toContain("informed refusal");
  });

  it("includes record-correction rules for addenda", () => {
    expect(retrieveContext("Addendum to the note from last week.").sources).toContain(
      "record correction"
    );
    const r = retrieveContext("This is a late entry correcting the material.");
    expect(r.sources).toContain("record correction");
    expect(r.text).toContain("never rewritten");
  });

  it("includes radiograph-record rules when imaging is mentioned", () => {
    expect(retrieveContext("4 BWs taken today.").sources).toContain("radiograph records");
    expect(retrieveContext("CBCT acquired for implant planning.").sources).toContain(
      "radiograph records"
    );
    // Interpretation guidance never fires without an imaging cue.
    expect(retrieveContext("Prophylaxis completed.").sources).not.toContain("radiograph records");
  });

  it("returns empty for text that triggers nothing", () => {
    const r = retrieveContext("Patient rescheduled the visit.");
    expect(r.sources).toEqual([]);
    expect(r.text).toBe("");
  });

  it("caps the context size", () => {
    // Trip every trigger at once and stay under the cap.
    const everything =
      "RCT SRP BW PANO FMX CBCT TMJ IANB sedation midazolam consent risks and benefits tooth 19 " +
      "NKDA prn qd BP f/u OHI SSC FPD RPD PARL MTA IRM ZOE RMGI WNL NAD s/p tx pt hx dx rx LA N2O IVS EBL";
    const r = retrieveContext(everything);
    expect(r.text.length).toBeLessThanOrEqual(4000);
  });
});

describe("service passes retrieval into the system prompt", () => {
  it("the model sees the practice standards for matching text", async () => {
    let seenSystem = "";
    const spy: GenerateFn = async ({ system, prompt }) => {
      seenSystem = system;
      return prompt;
    };
    const out = await runAssist("normalize", "RCT started on tooth 19.", spy);
    expect(out.ok).toBe(true);
    expect(seenSystem).toContain("PRACTICE STANDARDS");
    expect(seenSystem).toContain("root canal therapy");
    if (out.ok) expect(out.retrievedSources).toContain("practice terminology");
  });

  it("no retrieval section when nothing applies", async () => {
    let seenSystem = "";
    const spy: GenerateFn = async ({ system, prompt }) => {
      seenSystem = system;
      return prompt;
    };
    await runAssist("normalize", "Patient rescheduled the visit.", spy);
    expect(seenSystem).not.toContain("PRACTICE STANDARDS");
  });
});
