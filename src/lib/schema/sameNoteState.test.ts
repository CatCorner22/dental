import { describe, expect, it } from "vitest";
import { sameNoteState } from "./sameNoteState";
import type { NoteState } from "./types";

const base: NoteState = {
  selectedModuleIds: ["universal-core", "extraction"],
  values: {
    "extraction.tooth": { kind: "teeth", teeth: ["3", "14"] },
    "universal-core.reason": { kind: "text", value: "pain" }
  }
};

describe("sameNoteState", () => {
  it("treats an identical note as unchanged", () => {
    expect(sameNoteState(base, structuredClone(base))).toBe(true);
  });

  // This is the property the duplicate-ticket fix depends on: a title-only
  // autosave carries the same note object, and it must NOT read as an edit.
  it("ignores the insertion order of value keys and record fields", () => {
    const reordered: NoteState = {
      selectedModuleIds: ["universal-core", "extraction"],
      values: {
        "universal-core.reason": { value: "pain", kind: "text" } as NoteState["values"][string],
        "extraction.tooth": { kind: "teeth", teeth: ["3", "14"] }
      }
    };
    expect(sameNoteState(base, reordered)).toBe(true);
  });

  it("sees a real content edit as changed", () => {
    const edited = structuredClone(base);
    (edited.values["universal-core.reason"] as { value: string }).value = "swelling";
    expect(sameNoteState(base, edited)).toBe(false);
  });

  it("sees an added or removed value as changed", () => {
    const added = structuredClone(base);
    added.values["extraction.note"] = { kind: "text", value: "atraumatic" };
    expect(sameNoteState(base, added)).toBe(false);
  });

  // Reordering teeth or modules is a genuine edit, not a no-op.
  it("treats array reordering as a change", () => {
    const swapped = structuredClone(base);
    swapped.values["extraction.tooth"] = { kind: "teeth", teeth: ["14", "3"] };
    expect(sameNoteState(base, swapped)).toBe(false);
    const modSwap = structuredClone(base);
    modSwap.selectedModuleIds = ["extraction", "universal-core"];
    expect(sameNoteState(base, modSwap)).toBe(false);
  });
});
