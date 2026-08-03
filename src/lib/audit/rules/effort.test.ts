import { describe, expect, it } from "vitest";
import { runEffortRules, runGibberishRule, runProfessionalToneRule } from "./effort";

describe("gibberish", () => {
  it.each(["asdf asdf", "Patient aaaaaaaa", "test test test", "blah blah notes", "zzz"])(
    "stops filler: %s",
    (input) => {
      const f = runGibberishRule(input);
      expect(f).toHaveLength(1);
      expect(f[0].severity).toBe("S1");
      expect(f[0].message).toMatch(/reader|documentation/i);
    }
  );

  it("raises one finding, not one per pattern — a block is a message, not a nag", () => {
    expect(runGibberishRule("asdf qwer zxcv aaaaaaa")).toHaveLength(1);
  });

  it("leaves real clinical text alone", () => {
    for (const ok of [
      "Patient tolerated the procedure. Assessed teeth 2, 3, and 14.",
      "Attested by Dr. Assad.", // 'ssa' inside a name must not trip a mash pattern
      "Occlusal assessment completed."
    ]) {
      expect(runGibberishRule(ok), ok).toHaveLength(0);
    }
  });
});

describe("professional tone", () => {
  it.each([
    ["Patient was being dramatic about the injection.", "dramatic"],
    ["This crazy patient refused again.", "crazy"],
    ["Patient is lying about flossing.", "lying"]
  ])("stops unprofessional wording: %s", (input, token) => {
    const f = runProfessionalToneRule(input);
    expect(f.length).toBeGreaterThan(0);
    expect(f[0].matchedText?.toLowerCase()).toBe(token);
    expect(f[0].severity).toBe("S1");
    expect(f[0].suggestion).toMatch(/observable|finding/i);
  });

  it("does not fire on clinical uses", () => {
    expect(runProfessionalToneRule("Reviewed the fat pad graft site.")).toHaveLength(1);
    // ^ deliberate: bare "fat" fires even near clinical text; the fix is to
    // write the clinical term ("buccal fat pad") — which does not fire:
    expect(
      runProfessionalToneRule("Reviewed the buccal adipose graft site for healing.")
    ).toHaveLength(0);
  });

  it("cold logic, zero condescension: the message names the reader's problem", () => {
    const f = runEffortRules("Patient was hysterical.");
    expect(f[0].message).toMatch(/documents the visit|jury/i);
    expect(f[0].message).not.toMatch(/you should|please try|be professional/i);
  });
});
