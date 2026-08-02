import { describe, expect, it } from "vitest";
import { validateNoteState } from "./validateNoteState";

const valid = {
  selectedModuleIds: ["extraction"],
  values: {
    "extraction.procedure": { kind: "select", value: "simple extraction" },
    "extraction.teeth": { kind: "teeth", teeth: ["30"] }
  }
};

describe("validateNoteState", () => {
  it("accepts a well-formed note", () => {
    const r = validateNoteState(valid);
    expect(r.ok).toBe(true);
  });

  it("rejects unknown module ids", () => {
    expect(validateNoteState({ selectedModuleIds: ["nope"], values: {} }).ok).toBe(false);
  });

  it("rejects malformed field keys and values", () => {
    expect(validateNoteState({ selectedModuleIds: [], values: { "bad key": { kind: "text", value: "x" } } }).ok).toBe(false);
    expect(validateNoteState({ selectedModuleIds: [], values: { "a.b": { kind: "script", value: "x" } } }).ok).toBe(false);
    expect(validateNoteState({ selectedModuleIds: [], values: { "a.b": { kind: "text", value: 5 } } }).ok).toBe(false);
    expect(validateNoteState({ selectedModuleIds: [], values: { "a.b": { kind: "measurement", value: Infinity, unit: "mm" } } }).ok).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(validateNoteState(null).ok).toBe(false);
    expect(validateNoteState([]).ok).toBe(false);
    expect(validateNoteState({ selectedModuleIds: "x", values: {} }).ok).toBe(false);
  });

  it("accepts an empty note (no modules, no values)", () => {
    const r = validateNoteState({ selectedModuleIds: [], values: {} });
    expect(r.ok).toBe(true);
  });
});
