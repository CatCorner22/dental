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
