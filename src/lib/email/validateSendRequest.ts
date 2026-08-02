export interface SendNoteRequest {
  filename: string; // sanitized base name, extension added from format
  format: "md" | "txt";
  content: string;
  phiOverride?: { confirmed: true; reason: string };
}

export type ValidationResult =
  | { ok: true; value: SendNoteRequest }
  | { ok: false; status: number; error: string };

const MAX_CONTENT_CHARS = 200_000;

// Defense in depth: the schema has no recipient concept at all, and any
// attempt to smuggle one in is an explicit failure, not an ignored field.
const FORBIDDEN_KEYS = ["to", "cc", "bcc", "recipient", "recipients", "email", "address"];

export function validateSendRequest(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, status: 400, error: "The request body must be a JSON object." };
  }
  const record = body as Record<string, unknown>;

  for (const key of Object.keys(record)) {
    if (FORBIDDEN_KEYS.includes(key.toLowerCase())) {
      return {
        ok: false,
        status: 400,
        error: "This endpoint sends only to the configured corporate address. Remove recipient fields."
      };
    }
  }

  const { filename, format, content, phiOverride } = record;
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
  if (typeof content !== "string" || content.trim().length === 0) {
    return { ok: false, status: 400, error: "content must be a non-empty string." };
  }
  if (content.length > MAX_CONTENT_CHARS) {
    return { ok: false, status: 413, error: "The note is too large to email." };
  }

  let override: SendNoteRequest["phiOverride"];
  if (phiOverride !== undefined) {
    if (
      typeof phiOverride !== "object" ||
      phiOverride === null ||
      (phiOverride as Record<string, unknown>).confirmed !== true ||
      typeof (phiOverride as Record<string, unknown>).reason !== "string" ||
      ((phiOverride as Record<string, unknown>).reason as string).trim().length < 5
    ) {
      return {
        ok: false,
        status: 400,
        error: "phiOverride requires confirmed: true and a written reason."
      };
    }
    const reason = ((phiOverride as Record<string, unknown>).reason as string).trim();
    override = { confirmed: true, reason };
  }

  return {
    ok: true,
    value: { filename, format, content, phiOverride: override }
  };
}
