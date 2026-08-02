// Pure autosave state machine — no React, no timers, fully testable. The hook
// (useAutosave) drives it with debounced events; this file owns the logic of
// what state a draft's save is in and how each event transitions it.

export type AutosaveState =
  | { status: "idle" }
  | { status: "dirty" }
  | { status: "saving" }
  | { status: "saved"; at: number }
  | { status: "conflict"; serverVersion: number }
  | { status: "error"; message: string };

export type AutosaveEvent =
  | { type: "edit" }
  | { type: "saveStart" }
  | { type: "saveOk"; version: number; at: number }
  | { type: "save409"; serverVersion: number }
  | { type: "saveErr"; message: string }
  | { type: "resolved" }; // conflict acknowledged / reloaded

export const initialAutosave: AutosaveState = { status: "idle" };

// True when there is unsaved work — drives the beforeunload guard and whether
// a debounced save should fire. "error" and "conflict" both mean local edits
// exist that the server has not accepted, so closing the tab loses work.
export function isDirty(s: AutosaveState): boolean {
  return s.status === "dirty" || s.status === "saving" || s.status === "error" || s.status === "conflict";
}

export function needsSave(s: AutosaveState): boolean {
  return s.status === "dirty";
}

export function autosaveReducer(state: AutosaveState, event: AutosaveEvent): AutosaveState {
  switch (event.type) {
    case "edit":
      // An edit always marks work pending, even mid-save (a trailing save
      // follows), but never overwrites an unresolved conflict. Returning the
      // SAME reference when already dirty lets React bail out of the
      // re-render — without it, a render -> effect -> dispatch loop starves
      // the debounce and autosave never fires.
      if (state.status === "conflict" || state.status === "dirty") return state;
      return { status: "dirty" };
    case "saveStart":
      // A save may start from dirty, from error (a retry), or from idle (a
      // save kicked off right after a conflict resolves) — never from an
      // unresolved conflict, and a stale saveStart never demotes "saved".
      return state.status === "conflict" || state.status === "saved" ? state : { status: "saving" };
    case "saveOk":
      // A save that completes after a fresh edit stays dirty so the edit is not lost.
      return state.status === "saving" ? { status: "saved", at: event.at } : state;
    case "save409":
      return { status: "conflict", serverVersion: event.serverVersion };
    case "saveErr":
      return { status: "error", message: event.message };
    case "resolved":
      return { status: "idle" };
  }
}
