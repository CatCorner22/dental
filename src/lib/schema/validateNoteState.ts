import type { FieldValue, NoteState } from "@/lib/schema/types";
import { MODULES_BY_ID } from "@/lib/modules";

export type NoteStateResult =
  | { ok: true; value: NoteState }
  | { ok: false; error: string };

const MAX_FIELDS = 2000;
const MAX_TEXT_CHARS = 20_000;
const VALUE_KINDS = ["select", "multiselect", "text", "teeth", "surfaces", "measurement"];

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// The client sends structured values, never prose. The server composes the
// note itself, so nothing a tampered client submits reaches an attachment
// without passing the full audit.
export function validateFieldValue(v: unknown): v is FieldValue {
  if (!isPlainObject(v) || typeof v.kind !== "string" || !VALUE_KINDS.includes(v.kind)) {
    return false;
  }
  switch (v.kind) {
    case "select":
      return (
        typeof v.value === "string" &&
        v.value.length <= MAX_TEXT_CHARS &&
        (v.otherText === undefined ||
          (typeof v.otherText === "string" && v.otherText.length <= MAX_TEXT_CHARS))
      );
    case "multiselect":
      return (
        Array.isArray(v.values) &&
        v.values.every((x) => typeof x === "string" && x.length <= MAX_TEXT_CHARS)
      );
    case "text":
      return typeof v.value === "string" && v.value.length <= MAX_TEXT_CHARS;
    case "teeth":
      return Array.isArray(v.teeth) && v.teeth.every((x) => typeof x === "string" && x.length <= 8);
    case "surfaces":
      return (
        isPlainObject(v.byTooth) &&
        Object.values(v.byTooth).every(
          (s) => Array.isArray(s) && s.every((x) => typeof x === "string" && x.length <= 2)
        )
      );
    case "measurement":
      return (
        (v.value === null || (typeof v.value === "number" && Number.isFinite(v.value))) &&
        typeof v.unit === "string" &&
        v.unit.length <= 16
      );
    default:
      return false;
  }
}

export function validateNoteState(note: unknown): NoteStateResult {
  if (!isPlainObject(note)) return { ok: false, error: "note must be an object." };
  const { selectedModuleIds, values } = note;
  if (
    !Array.isArray(selectedModuleIds) ||
    !selectedModuleIds.every((id) => typeof id === "string" && MODULES_BY_ID.has(id))
  ) {
    return { ok: false, error: "note.selectedModuleIds must list known module ids." };
  }
  if (!isPlainObject(values)) return { ok: false, error: "note.values must be an object." };
  const entries = Object.entries(values);
  if (entries.length > MAX_FIELDS) return { ok: false, error: "The note has too many fields." };
  for (const [key, value] of entries) {
    if (!/^[a-z0-9-]+\.[a-z0-9-]+$/.test(key)) {
      return { ok: false, error: `note.values has an invalid field key: ${key}` };
    }
    if (!validateFieldValue(value)) {
      return { ok: false, error: `note.values.${key} is not a valid field value.` };
    }
  }
  return {
    ok: true,
    value: { selectedModuleIds, values: values as Record<string, FieldValue> }
  };
}
