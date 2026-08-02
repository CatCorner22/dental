import type { NoteState } from "@/lib/schema/types";
import { isPlainObject, validateNoteState } from "@/lib/schema/validateNoteState";

export interface SendNoteRequest {
  filename: string; // sanitized base name, extension added from format
  format: "md" | "txt";
  note: NoteState;
  phiOverride?: { confirmed: true; reason: string };
}

export type ValidationResult =
  | { ok: true; value: SendNoteRequest }
  | { ok: false; status: number; error: string };

// Defense in depth: the schema has no recipient concept at all, and any
// attempt to smuggle one in is an explicit failure, not an ignored field.
const FORBIDDEN_KEYS = ["to", "cc", "bcc", "recipient", "recipients", "email", "address"];

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

  const noteResult = validateNoteState(note);
  if (!noteResult.ok) {
    return { ok: false, status: 400, error: noteResult.error };
  }
  if (Object.keys(noteResult.value.values).length === 0) {
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
    value: { filename, format, note: noteResult.value, phiOverride: override }
  };
}
