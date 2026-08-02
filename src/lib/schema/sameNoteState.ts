import type { NoteState } from "./types";

// Order-independent deep stringify: object keys are emitted sorted, so two
// records that differ only in insertion order compare equal. Arrays keep their
// order (reordering teeth or module ids IS a real edit). Used to decide whether
// a note actually changed, which is what gates re-filing a submission.
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonical(obj[k])).join(",") + "}";
}

// True when two note states carry identical content. A title-only autosave
// arrives with the note unchanged; treating that as an edit would clear the
// re-file guard and let a duplicate ticket be filed for the same encounter.
export function sameNoteState(a: NoteState, b: NoteState): boolean {
  return canonical(a) === canonical(b);
}
