import { describe, expect, it } from "vitest";

import {
  nextSectionKey,
  orderedSectionKeys,
  reviewProgress,
  reviewSection,
  sectionSignature
} from "./sectionReview";
import type { ModuleDef, NoteState } from "@/lib/schema/types";

// The section loop is the shape of the whole screen now — write a section, ask
// what the deterministic tools make of it, accept or change, move on. These
// tests are on the RULE rather than the current contents of universal-core, so
// a new field cannot quietly change what "this section is done" means.

const MODULE: ModuleDef = {
  id: "m",
  title: "Test module",
  order: 0,
  sections: [
    {
      id: "narrative",
      title: "Visit narrative",
      fields: [{ id: "prose", type: "textarea", label: "In your own words" }]
    },
    {
      id: "visit",
      title: "Visit",
      fields: [
        { id: "purpose", type: "text", label: "Visit purpose", required: true },
        { id: "notes", type: "text", label: "Other notes" }
      ]
    },
    {
      id: "assessment",
      title: "Assessment",
      fields: [{ id: "diagnosis", type: "text", label: "Diagnosis", required: true }]
    }
  ]
};

const LATER: ModuleDef = {
  ...MODULE,
  id: "z",
  order: 50,
  sections: [{ id: "extra", title: "Extra", fields: [{ id: "x", type: "text", label: "X" }] }]
};

const note = (values: NoteState["values"] = {}): NoteState => ({
  selectedModuleIds: ["m"],
  values
});

const sect = (id: string) => MODULE.sections.find((s) => s.id === id)!;
const review = (
  sectionId: string,
  values: NoteState["values"] = {},
  findings = {},
  role: "dentist" | "hygienist" = "dentist"
) => reviewSection(MODULE, sect(sectionId), note(values), findings, role);

describe("what a section still needs", () => {
  it("names the required fields that are empty", () => {
    const r = review("visit");
    expect(r.openRequired.map((o) => o.label)).toEqual(["Visit purpose"]);
    expect(r.blocked).toBe(true);
  });

  it("stops naming one once it is filled", () => {
    const r = review("visit", { "m.purpose": { kind: "text", value: "Routine recall." } });
    expect(r.openRequired).toEqual([]);
    expect(r.blocked).toBe(false);
  });

  it("treats whitespace as empty, exactly as the audit does", () => {
    expect(review("visit", { "m.purpose": { kind: "text", value: "   " } }).blocked).toBe(true);
  });

  it("reports findings separately from empty required fields", () => {
    // "fill this in" and "look again at what you wrote" are different requests.
    // Counting a required.missing as both would double-count one empty box.
    const r = review(
      "visit",
      { "m.purpose": { kind: "text", value: "Routine recall." } },
      {
        "m.purpose": [
          { ruleId: "required.missing", category: "required", severity: "S1", message: "empty" },
          { ruleId: "vague.x", category: "vague-phrase", severity: "S2", message: "vague" }
        ]
      }
    );
    expect(r.findings.map((f) => f.ruleId)).toEqual(["vague.x"]);
  });
});

describe("what the deterministic pass proposes", () => {
  it("offers a rewrite without applying it", () => {
    // The whole contract: this function reports, it never returns a new note.
    const before = "pt tolerated the procedure well";
    const r = review("narrative", { "m.prose": { kind: "text", value: before } });
    expect(r.proposals).toHaveLength(1);
    expect(r.proposals[0].fieldKey).toBe("m.prose");
    expect(r.proposals[0].label).toBe("In your own words");
    expect(r.proposals[0].before).toBe(before);
    expect(r.proposals[0].after).not.toBe(before);
    expect(r.proposals[0].after.toLowerCase()).toContain("patient");
  });

  it("proposes nothing for wording that is already standard", () => {
    const r = review("narrative", {
      "m.prose": { kind: "text", value: "The patient tolerated the procedure well." }
    });
    expect(r.proposals).toEqual([]);
  });

  it("proposes nothing for an empty field", () => {
    expect(review("narrative", { "m.prose": { kind: "text", value: "  " } }).proposals).toEqual([]);
  });

  it("never proposes into a section this licence may not write", () => {
    // A hygienist cannot author Assessment. Offering them an Apply button whose
    // only outcome is a 403 on the next autosave teaches the rule by error
    // message rather than by the interface.
    const CORE: ModuleDef = { ...MODULE, id: "universal-core" };
    const r = reviewSection(
      CORE,
      CORE.sections.find((s) => s.id === "assessment")!,
      { selectedModuleIds: ["universal-core"], values: {} },
      {},
      "hygienist"
    );
    expect(r.proposals).toEqual([]);
    expect(r.openRequired).toEqual([]);
    expect(r.blocked).toBe(false);
  });
});

describe("when a section is done", () => {
  it("is clean only when nothing is proposed, flagged or missing", () => {
    expect(review("narrative").clean).toBe(true);
    expect(review("visit").clean).toBe(false);
  });

  it("is not clean merely because nothing is required", () => {
    const r = review("narrative", { "m.prose": { kind: "text", value: "pt seen today" } });
    expect(r.blocked).toBe(false);
    expect(r.clean).toBe(false); // there is a proposal to answer
  });
});

describe("a review expires when the words change", () => {
  // "I read this and it was right" was said about words. Change the words and
  // it stops being true, which is the only honest behaviour for a tick that
  // means somebody checked something.
  it("changes signature when a value changes", () => {
    const a = sectionSignature(MODULE, sect("visit"), note({ "m.purpose": { kind: "text", value: "A" } }));
    const b = sectionSignature(MODULE, sect("visit"), note({ "m.purpose": { kind: "text", value: "B" } }));
    expect(a).not.toBe(b);
  });

  it("is stable when nothing in the section changed", () => {
    const values = { "m.purpose": { kind: "text" as const, value: "A" } };
    expect(sectionSignature(MODULE, sect("visit"), note(values))).toBe(
      sectionSignature(MODULE, sect("visit"), note(values))
    );
  });

  it("ignores edits to other sections", () => {
    // Typing in the narrative must not un-check the visit section.
    const base = { "m.purpose": { kind: "text" as const, value: "A" } };
    expect(sectionSignature(MODULE, sect("visit"), note(base))).toBe(
      sectionSignature(
        MODULE,
        sect("visit"),
        note({ ...base, "m.prose": { kind: "text", value: "anything" } })
      )
    );
  });
});

describe("where continue goes", () => {
  it("walks the sections in the order they are shown", () => {
    expect(orderedSectionKeys([MODULE])).toEqual(["m.narrative", "m.visit", "m.assessment"]);
  });

  it("orders across modules by the module order, not array order", () => {
    // composeNote sorts by `order`; "next" has to mean next on the screen.
    expect(orderedSectionKeys([LATER, MODULE])).toEqual([
      "m.narrative",
      "m.visit",
      "m.assessment",
      "z.extra"
    ]);
  });

  it("goes to the next section", () => {
    expect(nextSectionKey([MODULE], "m.narrative")).toBe("m.visit");
    expect(nextSectionKey([MODULE], "m.visit")).toBe("m.assessment");
  });

  it("crosses into the next module at the end of one", () => {
    expect(nextSectionKey([MODULE, LATER], "m.assessment")).toBe("z.extra");
  });

  it("returns null at the end rather than wrapping to the top", () => {
    // Wrapping would send somebody who just finished the note back to its
    // first box, which reads as the tool losing their place.
    expect(nextSectionKey([MODULE], "m.assessment")).toBeNull();
  });

  it("returns null for a section that is not in the note", () => {
    // A module removed while its review panel was open. Jumping to position 0
    // would be a guess; not moving is not.
    expect(nextSectionKey([MODULE], "gone.section")).toBeNull();
  });
});

describe("how far through the note somebody is", () => {
  const sig = (id: string, values: NoteState["values"]) =>
    sectionSignature(MODULE, sect(id), note(values));

  it("counts nothing on an untouched note", () => {
    expect(reviewProgress([MODULE], {}, note())).toEqual({ done: 0, total: 3 });
  });

  it("counts a section whose signature still matches", () => {
    const values = { "m.purpose": { kind: "text" as const, value: "Routine recall." } };
    const reviewed = { "m.visit": sig("visit", values) };
    expect(reviewProgress([MODULE], reviewed, note(values))).toEqual({ done: 1, total: 3 });
  });

  it("stops counting a section that was edited after it was checked", () => {
    const checkedAt = { "m.purpose": { kind: "text" as const, value: "Routine recall." } };
    const reviewed = { "m.visit": sig("visit", checkedAt) };
    const now = { "m.purpose": { kind: "text" as const, value: "Routine recall. Also this." } };
    expect(reviewProgress([MODULE], reviewed, note(now))).toEqual({ done: 0, total: 3 });
  });

  it("counts sections from every module in the note", () => {
    expect(reviewProgress([MODULE, LATER], {}, note()).total).toBe(4);
  });
});
