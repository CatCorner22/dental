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
// a debounced save should fire.
export function isDirty(s: AutosaveState): boolean {
  return s.status === "dirty" || s.status === "saving";
}

export function needsSave(s: AutosaveState): boolean {
  return s.status === "dirty";
}

export function autosaveReducer(state: AutosaveState, event: AutosaveEvent): AutosaveState {
  switch (event.type) {
    case "edit":
      // An edit always marks work pending, even mid-save (a trailing save
      // follows), but never overwrites an unresolved conflict.
      if (state.status === "conflict") return state;
      return { status: "dirty" };
    case "saveStart":
      return state.status === "dirty" ? { status: "saving" } : state;
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
