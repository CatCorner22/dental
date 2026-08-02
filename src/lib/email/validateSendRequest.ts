import type { FieldValue, NoteState } from "@/lib/schema/types";
import { MODULES_BY_ID } from "@/lib/modules";

export interface SendNoteRequest {
  filename: string; // sanitized base name, extension added from format
  format: "md" | "txt";
  note: NoteState;
  phiOverride?: { confirmed: true; reason: string };
}

export type ValidationResult =
  | { ok: true; value: SendNoteRequest }
  | { ok: false; status: number; error: string };

const MAX_FIELDS = 2000;
const MAX_TEXT_CHARS = 20_000;

// Defense in depth: the schema has no recipient concept at all, and any
// attempt to smuggle one in is an explicit failure, not an ignored field.
const FORBIDDEN_KEYS = ["to", "cc", "bcc", "recipient", "recipients", "email", "address"];

const VALUE_KINDS = ["select", "multiselect", "text", "teeth", "surfaces", "measurement"];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// The client sends structured values, never prose. The server composes the
// note itself, so nothing a tampered client submits can reach the attachment
// without passing the full audit.
function validateFieldValue(v: unknown): v is FieldValue {
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

export function validateSendRequest(body: unknown): ValidationResult {
  if (!isPlainObject(body)) {
    return { ok: false, status: 400, error: "The request body must be a JSON object." };
  }

  for (const key of Object.keys(body)) {
    if (FORBIDDEN_KEYS.includes(key.toLowerCase())) {
      return {
        ok: false,
        status: 400,
        error: "This endpoint sends only to the configured corporate address. Remove recipient fields."
      };
    }
  }

  const { filename, format, note, phiOverride } = body;
  if (typeof filename !== "string" || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(filename)) {
    return {
      ok: false,
      status: 400,
      error: "filename must be 1-80 lowercase letters, digits, or hyphens."
    };
  }
  if (format !== "md" && format !== "txt") {
    return { ok: false, status: 400, error: "format must be md or txt." };
  }

  if (!isPlainObject(note)) {
    return { ok: false, status: 400, error: "note must be an object." };
  }
  const { selectedModuleIds, values } = note;
  if (
    !Array.isArray(selectedModuleIds) ||
    !selectedModuleIds.every((id) => typeof id === "string" && MODULES_BY_ID.has(id))
  ) {
    return { ok: false, status: 400, error: "note.selectedModuleIds must list known module ids." };
  }
  if (!isPlainObject(values)) {
    return { ok: false, status: 400, error: "note.values must be an object." };
  }
  const entries = Object.entries(values);
  if (entries.length > MAX_FIELDS) {
    return { ok: false, status: 413, error: "The note has too many fields." };
  }
  for (const [key, value] of entries) {
    if (!/^[a-z0-9-]+\.[a-z0-9-]+$/.test(key)) {
      return { ok: false, status: 400, error: `note.values has an invalid field key: ${key}` };
    }
    if (!validateFieldValue(value)) {
      return { ok: false, status: 400, error: `note.values.${key} is not a valid field value.` };
    }
  }
  if (entries.length === 0) {
    return { ok: false, status: 400, error: "The note is empty." };
  }

  let override: SendNoteRequest["phiOverride"];
  if (phiOverride !== undefined) {
    if (
      !isPlainObject(phiOverride) ||
      phiOverride.confirmed !== true ||
      typeof phiOverride.reason !== "string" ||
      phiOverride.reason.trim().length < 5
    ) {
      return {
        ok: false,
        status: 400,
        error: "phiOverride requires confirmed: true and a written reason."
      };
    }
    override = { confirmed: true, reason: phiOverride.reason.trim() };
  }

  return {
    ok: true,
    value: {
      filename,
      format,
      note: { selectedModuleIds, values: values as Record<string, FieldValue> },
      phiOverride: override
    }
  };
}
