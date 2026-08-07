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

/**
 * What to show the writer when a save is refused.
 *
 * Pure, and here rather than in the hook, so it can be tested: the save chain
 * stops on an error, and although a soft retry re-runs it every few seconds,
 * that retry is silent — so this string is the entire explanation a writer
 * gets for why their work is not on the server. It used to
 * be `Save failed (403).` unconditionally, and the worst case of that was the
 * scope-of-practice refusal — a hygienist who typed a diagnosis got a status
 * code, no route forward, and unsaved work in a field they were never permitted
 * to author. The route already sends a sentence for every refusal; this prefers
 * it and keeps the code only for a failure with no body (a proxy, a 502).
 */
export function saveErrorMessage(status: number, body: { error?: unknown }): string {
  const sentence = typeof body.error === "string" ? body.error.trim() : "";
  // Not every sentence the route sends is addressed to a writer. Most are —
  // "You cannot edit this draft." tells somebody exactly where they stand —
  // but the validation branches answer a programmer: `baseVersion must be an
  // integer.` names a field of the wire format, not anything on the screen,
  // and a person reading it in the corner of a note has no move to make. A
  // bare status code is the same failure with fewer words. Both become the
  // one thing that IS true and actionable in that case: the note is intact,
  // reloading is the fix.
  if (sentence.length > 0 && !looksInternal(sentence)) return sentence;
  if (status >= 500) return "The server could not save this note.";
  return "Smile Notes could not save this note — reload the page to pick it up again.";
}

/**
 * A message written for whoever is reading a stack trace rather than a note.
 *
 * Deliberately a small, literal list of the wire-format words this app's own
 * routes use, not a cleverness that tries to judge English: a false positive
 * here throws away a refusal the writer needed to read, which is the worse
 * error of the two.
 */
const INTERNAL_WORDS = ["baseVersion", "JSON", "noteState", "selectedModuleIds", "payload"];

function looksInternal(sentence: string): boolean {
  return INTERNAL_WORDS.some((w) => sentence.includes(w));
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
