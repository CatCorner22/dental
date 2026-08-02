import { describe, expect, it } from "vitest";
import {
  autosaveReducer,
  initialAutosave,
  isDirty,
  needsSave,
  type AutosaveState
} from "./autosaveMachine";

function run(events: Parameters<typeof autosaveReducer>[1][]): AutosaveState {
  return events.reduce(autosaveReducer, initialAutosave);
}

describe("autosaveMachine", () => {
  it("edit -> dirty -> saving -> saved", () => {
    let s = run([{ type: "edit" }]);
    expect(s.status).toBe("dirty");
    expect(needsSave(s)).toBe(true);
    s = autosaveReducer(s, { type: "saveStart" });
    expect(s.status).toBe("saving");
    expect(isDirty(s)).toBe(true);
    s = autosaveReducer(s, { type: "saveOk", version: 2, at: 123 });
    expect(s).toEqual({ status: "saved", at: 123 });
    expect(isDirty(s)).toBe(false);
  });

  it("an edit during a save keeps work pending (trailing save)", () => {
    let s = run([{ type: "edit" }, { type: "saveStart" }, { type: "edit" }]);
    expect(s.status).toBe("dirty");
    // A save completing now must NOT clear the newer edit.
    s = autosaveReducer(s, { type: "saveOk", version: 2, at: 1 });
    expect(s.status).toBe("dirty");
  });

  it("a version conflict wins and survives further edits until resolved", () => {
    let s = run([{ type: "edit" }, { type: "saveStart" }, { type: "save409", serverVersion: 9 }]);
    expect(s).toEqual({ status: "conflict", serverVersion: 9 });
    s = autosaveReducer(s, { type: "edit" });
    expect(s.status).toBe("conflict");
    s = autosaveReducer(s, { type: "resolved" });
    expect(s.status).toBe("idle");
  });

  it("surfaces save errors", () => {
    const s = run([{ type: "edit" }, { type: "saveStart" }, { type: "saveErr", message: "network" }]);
    expect(s).toEqual({ status: "error", message: "network" });
  });

  it("saveStart is ignored when not dirty", () => {
    expect(autosaveReducer(initialAutosave, { type: "saveStart" })).toEqual(initialAutosave);
  });
});

describe("reference stability (render-loop guard)", () => {
  it("edit while already dirty returns the SAME state object", () => {
    const dirty = autosaveReducer(initialAutosave, { type: "edit" });
    const again = autosaveReducer(dirty, { type: "edit" });
    // Identity matters: a new object here re-renders React and forms a
    // render -> effect -> dispatch loop that starves the autosave debounce.
    expect(again).toBe(dirty);
  });
})
