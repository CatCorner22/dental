import { describe, expect, it } from "vitest";
import { CHECKLIST, CYCLES, evaluateGauntlet, type GauntletAnswers } from "./gauntlet";

// A request that genuinely clears all five cycles.
const STERILE: GauntletAnswers = {
  summary: "Add an implant torque value to the surgical Smile Note",
  changeType: "add",
  answers: {
    necessity:
      "The restorative dentist needs the insertion torque at the moment of restoration to decide whether to load immediately; without it we stop and phone the surgeon on every implant case.",
    exhaustion:
      "We reviewed the surgical note template, the operative report view, and every custom field on the implant chart. Torque is written in free text or not at all, so it cannot be filtered on.",
    ripple:
      "Chasing this by phone costs the front desk about 4 hours per week and delayed 9 restorations last quarter, which outweighs the build plus regression testing of charting and claims.",
    behavior:
      "The assistant records it at chart close on the surgical visit, the same moment the drill sequence is logged, and the restorative note refuses to open without it.",
    protection:
      "It closes a documented continuity gap: three charts last year had no torque recorded and the restoring dentist had to re-open the site to judge stability."
  },
  checklist: {
    auditCompleted: true,
    costQuantified: true,
    downstreamMapped: true,
    ownerAssigned: true,
    alternativesRuledOut: true
  },
  dataOwner: "Priya, surgical lead assistant",
  downstream: ["Charting", "Reporting"]
};

const clone = (): GauntletAnswers => JSON.parse(JSON.stringify(STERILE));

describe("evaluateGauntlet", () => {
  it("passes a genuinely sterile request", () => {
    const v = evaluateGauntlet(STERILE);
    expect(v.general).toEqual([]);
    expect(v.cycles.filter((c) => !c.sterile)).toEqual([]);
    expect(v.sterile).toBe(true);
  });

  it("defines all five cycles and five checklist items", () => {
    expect(CYCLES).toHaveLength(5);
    expect(CHECKLIST).toHaveLength(5);
    expect(CYCLES.map((c) => c.n)).toEqual([1, 2, 3, 4, 5]);
  });

  it("blocks an empty request and blames every cycle", () => {
    const v = evaluateGauntlet({
      summary: "",
      changeType: "",
      answers: { necessity: "", exhaustion: "", ripple: "", behavior: "", protection: "" },
      checklist: {
        auditCompleted: false,
        costQuantified: false,
        downstreamMapped: false,
        ownerAssigned: false,
        alternativesRuledOut: false
      },
      dataOwner: "",
      downstream: []
    });
    expect(v.sterile).toBe(false);
    expect(v.cycles.every((c) => !c.sterile)).toBe(true);
    expect(v.general.length).toBeGreaterThan(5);
  });

  it("blocks a too-short answer", () => {
    const a = clone();
    a.answers.necessity = "We need it.";
    const v = evaluateGauntlet(a);
    expect(v.sterile).toBe(false);
    expect(v.cycles[0].problems.join(" ")).toContain("Too short");
  });

  // Each contaminated exemplar from the guide must actually be caught.
  it.each([
    ["necessity", "It would be nice for later analysis and the dentists might find it interesting someday when we have time to look at it properly."],
    ["exhaustion", "I haven't fully audited the current system or asked the clinical team what already exists, but I am fairly sure we do not have this anywhere."],
    ["ripple", "It's just one field and one dropdown so nothing will break anywhere else in the system, and it is obviously worth doing for us."],
    ["behavior", "We'll mention it in the morning huddle and it will appear in a monthly review deck so everyone remembers to fill it in properly."],
    ["protection", "More granular data is always better for a practice like ours and it will help us in ways we cannot fully predict yet."]
  ])("blocks the contaminated exemplar for cycle %s", (id, text) => {
    const a = clone();
    a.answers[id as keyof typeof a.answers] = text;
    const v = evaluateGauntlet(a);
    expect(v.sterile).toBe(false);
    const cycle = v.cycles.find((c) => c.id === id)!;
    expect(cycle.sterile).toBe(false);
    expect(cycle.problems.join(" ")).toMatch(/Contaminated|choke point|measurable|checked/);
  });

  it("requires a real number in the ripple calculation", () => {
    const a = clone();
    a.answers.ripple =
      "This will save the team a great deal of time every single week and will clearly reduce a lot of errors across the practice.";
    const v = evaluateGauntlet(a);
    expect(v.cycles.find((c) => c.id === "ripple")!.problems.join(" ")).toContain("measurable gain");
  });

  it("requires cycle 2 to name what was checked", () => {
    const a = clone();
    a.answers.exhaustion =
      "We looked everywhere across the whole practice and asked several people about it, and we are confident it is genuinely not captured anywhere.";
    const v = evaluateGauntlet(a);
    expect(v.cycles.find((c) => c.id === "exhaustion")!.problems.join(" ")).toContain("Name what you actually checked");
  });

  it("requires cycle 4 to name a workflow choke point", () => {
    const a = clone();
    a.answers.behavior =
      "Everyone on the clinical team has agreed that they will remember to fill this in accurately whenever it happens to be relevant to them.";
    const v = evaluateGauntlet(a);
    expect(v.cycles.find((c) => c.id === "behavior")!.problems.join(" ")).toContain("choke point");
  });

  // The strongest slop signal: one paragraph pasted into every box.
  it("blocks the same answer pasted across cycles", () => {
    const a = clone();
    a.answers.protection = a.answers.necessity;
    const v = evaluateGauntlet(a);
    expect(v.sterile).toBe(false);
    expect(v.cycles.find((c) => c.id === "protection")!.problems.join(" ")).toContain("same answer");
  });

  it("blocks an answer that just restates the question", () => {
    const a = clone();
    const c = CYCLES[0];
    a.answers.necessity = c.prompt;
    const v = evaluateGauntlet(a);
    expect(v.cycles[0].problems.join(" ")).toMatch(/restates the question|Contaminated/);
  });

  it("blocks when the pre-flight checklist is incomplete", () => {
    const a = clone();
    a.checklist.downstreamMapped = false;
    const v = evaluateGauntlet(a);
    expect(v.sterile).toBe(false);
    expect(v.general.join(" ")).toContain("Downstream mapped");
  });

  it("blocks without a named data owner or a downstream module", () => {
    const a = clone();
    a.dataOwner = "";
    a.downstream = [];
    const v = evaluateGauntlet(a);
    expect(v.general.join(" ")).toContain("own this data");
    expect(v.general.join(" ")).toContain("downstream module");
  });

  it("blocks without a one-line ask", () => {
    const a = clone();
    a.summary = "fix";
    expect(evaluateGauntlet(a).general.join(" ")).toContain("one line");
  });

  it("tolerates missing objects rather than throwing", () => {
    // The server runs this on untrusted input; a malformed body must produce a
    // verdict, not a 500.
    const v = evaluateGauntlet({} as unknown as GauntletAnswers);
    expect(v.sterile).toBe(false);
  });
});

describe("hardening against gaming and denial of service", () => {
  // A measured 24-second event-loop block before the fix: two unbounded \s*
  // either side of an optional group let a digit run + whitespace run
  // backtrack quadratically. One field was enough to pin the whole server.
  it("evaluates a hostile 4000-char input in well under a second", () => {
    const hostile = "9".repeat(1000) + " ".repeat(2998) + "z!";
    const a = clone();
    a.answers.ripple = hostile;
    const started = Date.now();
    evaluateGauntlet(a);
    expect(Date.now() - started).toBeLessThan(500);
  });

  it("stays fast on hostile input aimed at every other pattern", () => {
    for (const seed of ["would be ", "haven t ", "might be ", "more data is always "]) {
      const a = clone();
      a.answers.necessity = seed + " ".repeat(3900);
      const started = Date.now();
      evaluateGauntlet(a);
      expect(Date.now() - started, seed).toBeLessThan(500);
    }
  });

  // Padding used to satisfy an 80-CHARACTER floor with three words.
  it("rejects whitespace padding masquerading as an argument", () => {
    const a = clone();
    a.answers.necessity = "chart" + " ".repeat(73) + "b";
    const v = evaluateGauntlet(a);
    expect(v.sterile).toBe(false);
    expect(v.cycles[0].problems.join(" ")).toMatch(/Too short|different words/);
  });

  // One zero-width space used to defeat BOTH the duplicate check and every
  // contaminated phrase, because normalize only collapsed ordinary whitespace.
  it("sees through zero-width characters", () => {
    const a = clone();
    a.answers.necessity = "It would​ be nice for later analysis and we might look at it someday when there is time to spare.";
    expect(evaluateGauntlet(a).cycles[0].problems.join(" ")).toContain("Contaminated");

    const b = clone();
    b.answers.protection = b.answers.necessity.slice(0, 10) + "​" + b.answers.necessity.slice(10);
    expect(evaluateGauntlet(b).cycles.find((c) => c.id === "protection")!.problems.join(" ")).toContain(
      "same answer"
    );
  });
});
