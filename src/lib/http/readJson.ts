// Safe request-body reader. `JSON.parse` happily returns null / numbers /
// strings / booleans, and `"key" in body` THROWS on all of them — so a body
// of literal `null` must become a clean 400, never a 500. Routes that accept
// an empty body (submit, create-draft) branch on "empty"; routes that require
// fields treat both "empty" and "invalid" as a 400.
export type JsonRecordResult =
  | { kind: "object"; value: Record<string, unknown> }
  | { kind: "empty" }
  | { kind: "invalid" };

export async function readJsonRecord(req: Request): Promise<JsonRecordResult> {
  let text: string;
  try {
    text = await req.text();
  } catch {
    return { kind: "invalid" };
  }
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
