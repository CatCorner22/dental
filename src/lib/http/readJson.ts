// Safe request-body reader. `JSON.parse` happily returns null / numbers /
// strings / booleans, and `"key" in body` THROWS on all of them — so a body
// of literal `null` must become a clean 400, never a 500. Routes that accept
// an empty body (submit, create-draft) branch on "empty"; routes that require
// fields treat both "empty" and "invalid" as a 400.
export type JsonRecordResult =
  | { kind: "object"; value: Record<string, unknown> }
  | { kind: "empty" }
  | { kind: "invalid" };

// The largest body any route legitimately sends. A note is already capped at
// 120k characters by validateNoteState — but that cap only applies AFTER the
// whole body has been read into memory and parsed, so without a limit here a
// single request could buffer hundreds of megabytes before any check runs.
export const MAX_BODY_BYTES = 1_000_000;

export async function readJsonRecord(req: Request): Promise<JsonRecordResult> {
  // Cheap pre-check: reject an oversized body on its declared length before
  // reading a byte of it.
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return { kind: "invalid" };
  }
  let text: string;
  try {
    text = await req.text();
  } catch {
    return { kind: "invalid" };
  }
  // Content-Length is absent or wrong under chunked encoding, so the real
  // guard is the size of what actually arrived.
  if (text.length > MAX_BODY_BYTES) return { kind: "invalid" };
  if (text.trim() === "") return { kind: "empty" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { kind: "invalid" };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { kind: "invalid" };
  }
  return { kind: "object", value: parsed as Record<string, unknown> };
}
