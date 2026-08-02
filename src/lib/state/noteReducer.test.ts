import { describe, expect, it } from "vitest";
import { initialNoteState, noteReducer } from "./noteReducer";

describe("noteReducer", () => {
  it("toggles a module on and off, clearing its values on removal", () => {
    let s = noteReducer(initialNoteState, { type: "toggleModule", moduleId: "extraction" });
    expect(s.selectedModuleIds).toContain("extraction");
    s = noteReducer(s, {
      type: "setValue",
      key: "extraction.procedure",
      value: { kind: "select", value: "simple extraction" }
    });
    s = noteReducer(s, {
      type: "setValue",
      key: "universal-core.site",
      value: { kind: "text", value: "keep me" }
    });
    s = noteReducer(s, { type: "toggleModule", moduleId: "extraction" });
    expect(s.selectedModuleIds).not.toContain("extraction");
    expect(s.values["extraction.procedure"]).toBeUndefined();
    expect(s.values["universal-core.site"]).toBeDefined();
  });

  it("clears a single value", () => {
    let s = noteReducer(initialNoteState, {
      type: "setValue",
      key: "a.b",
      value: { kind: "text", value: "x" }
    });
    s = noteReducer(s, { type: "clearValue", key: "a.b" });
    expect(s.values["a.b"]).toBeUndefined();
  });

  it("resets to the initial state", () => {
    let s = noteReducer(initialNoteState, {
      type: "setValue",
      key: "a.b",
      value: { kind: "text", value: "x" }
    });
    s = noteReducer(s, { type: "reset" });
    expect(s).toEqual(initialNoteState);
  });
});

describe("orphan surface pruning", () => {
  const teethKey = "direct-restorative.teeth";
  const surfKey = "direct-restorative.surfaces";

  it("drops surfaces for a tooth removed from the linked tooth field", () => {
    let s = noteReducer(initialNoteState, {
      type: "setValue",
      key: teethKey,
      value: { kind: "teeth", teeth: ["30"] }
    });
    s = noteReducer(s, {
      type: "setValue",
      key: surfKey,
      value: { kind: "surfaces", byTooth: { "30": ["M", "O", "D"] } }
    });
    // The clinician corrects the site to tooth 19.
    s = noteReducer(s, { type: "setValue", key: teethKey, value: { kind: "teeth", teeth: ["19"] } });
    const surfaces = s.values[surfKey];
    expect(surfaces?.kind).toBe("surfaces");
    if (surfaces?.kind === "surfaces") {
      expect(surfaces.byTooth["30"]).toBeUndefined();
      expect(Object.keys(surfaces.byTooth)).toEqual([]);
    }
  });

  it("keeps surfaces for teeth that remain selected", () => {
    let s = noteReducer(initialNoteState, {
      type: "setValue",
      key: teethKey,
      value: { kind: "teeth", teeth: ["30", "19"] }
    });
    s = noteReducer(s, {
      type: "setValue",
      key: surfKey,
      value: { kind: "surfaces", byTooth: { "30": ["M", "O"], "19": ["O"] } }
    });
    s = noteReducer(s, { type: "setValue", key: teethKey, value: { kind: "teeth", teeth: ["30"] } });
    const surfaces = s.values[surfKey];
    if (surfaces?.kind === "surfaces") {
      expect(surfaces.byTooth["30"]).toEqual(["M", "O"]);
      expect(surfaces.byTooth["19"]).toBeUndefined();
    }
  });
});
