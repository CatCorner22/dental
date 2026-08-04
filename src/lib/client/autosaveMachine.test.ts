import { describe, expect, it } from "vitest";
import {
  autosaveReducer,
  initialAutosave,
  isDirty,
  needsSave,
  saveErrorMessage,
  type AutosaveState
} from "./autosaveMachine";
import { scopeExplanation } from "@/lib/auth/clinicalRoles";

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

  it("surfaces save errors, and errors count as unsaved work", () => {
    const s = run([{ type: "edit" }, { type: "saveStart" }, { type: "saveErr", message: "network" }]);
    expect(s).toEqual({ status: "error", message: "network" });
    // Closing the tab now would lose the edits — the unload guard must fire.
    expect(isDirty(s)).toBe(true);
  });

  it("an unresolved conflict also counts as unsaved work", () => {
    const s = run([{ type: "edit" }, { type: "saveStart" }, { type: "save409", serverVersion: 4 }]);
    expect(isDirty(s)).toBe(true);
  });

  it("a retry after an error recovers to saved (indicator must not stick)", () => {
    let s = run([{ type: "edit" }, { type: "saveStart" }, { type: "saveErr", message: "offline" }]);
    s = autosaveReducer(s, { type: "saveStart" }); // flush() retries
    expect(s.status).toBe("saving");
    s = autosaveReducer(s, { type: "saveOk", version: 3, at: 9 });
    expect(s).toEqual({ status: "saved", at: 9 });
  });

  it("saveStart never disturbs a conflict or a clean saved state", () => {
    const conflict: AutosaveState = { status: "conflict", serverVersion: 2 };
    expect(autosaveReducer(conflict, { type: "saveStart" })).toBe(conflict);
    const saved: AutosaveState = { status: "saved", at: 5 };
    expect(autosaveReducer(saved, { type: "saveStart" })).toBe(saved);
  });

  it("a save kicked off right after a conflict resolves may start from idle", () => {
    // resolveConflict() -> idle, then the kept edits save immediately.
    const s = run([{ type: "edit" }, { type: "saveStart" }, { type: "save409", serverVersion: 4 }, { type: "resolved" }, { type: "saveStart" }]);
    expect(s.status).toBe("saving");
  });
});

describe("what a refused save tells the writer", () => {
  // The save chain stops on an error and never retries on its own, so this
  // string is the whole explanation for why a writer's work is not on the
  // server. It was `Save failed (403).` for every refusal.
  it("prefers the server's sentence over the status code", () => {
    expect(saveErrorMessage(400, { error: "That office is not on the practice's list." })).toBe(
      "That office is not on the practice's list."
    );
  });

  it("names the scope rule instead of the number 403", () => {
    // The regression that mattered. A hygienist who typed into Assessment got
    // "Save failed (403)." — no rule, no route forward, and unsaved work in a
    // field they were never permitted to author. The route sends this sentence;
    // the indicator must show it.
    const message = saveErrorMessage(403, { error: scopeExplanation("hygienist") });
    expect(message).toContain("dentist records the diagnosis");
    expect(message).not.toContain("403");
  });

  it("falls back to the status code when there is no body to read", () => {
    // A proxy or a gateway failure has no JSON. Something must still be said.
    expect(saveErrorMessage(502, {})).toBe("Save failed (502).");
    expect(saveErrorMessage(500, { error: "   " })).toBe("Save failed (500).");
    expect(saveErrorMessage(500, { error: 42 })).toBe("Save failed (500).");
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
