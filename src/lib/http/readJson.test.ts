import { describe, expect, it } from "vitest";
import { MAX_BODY_BYTES, readJsonRecord } from "./readJson";

function req(body: string | null): Request {
  return new Request("http://test.local/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    ...(body === null ? {} : { body })
  });
}

describe("readJsonRecord", () => {
  it("returns the object for a JSON object body", async () => {
    const r = await readJsonRecord(req('{"a":1}'));
    expect(r).toEqual({ kind: "object", value: { a: 1 } });
  });

  it("returns empty for a missing or blank body", async () => {
    expect((await readJsonRecord(req(null))).kind).toBe("empty");
    expect((await readJsonRecord(req("   "))).kind).toBe("empty");
  });

  // JSON.parse happily produces all of these, and `"key" in body` THROWS on
  // every one — each must be a clean "invalid", never a route-crashing 500.
  it("returns invalid for null, scalars, arrays, and garbage", async () => {
    for (const body of ["null", "5", '"hi"', "true", "[1,2]", "{not json"]) {
      expect((await readJsonRecord(req(body))).kind, body).toBe("invalid");
    }
  });

  // The note-size cap in validateNoteState only runs AFTER the body is read
  // and parsed, so without a limit here a single request could buffer an
  // arbitrary amount of memory before any check fires.
  it("rejects a body larger than the cap", async () => {
    const huge = `{"a":"${"x".repeat(MAX_BODY_BYTES)}"}`;
    expect((await readJsonRecord(req(huge))).kind).toBe("invalid");
  });

  it("still accepts a body just under the cap", async () => {
    const padding = "y".repeat(MAX_BODY_BYTES - 100);
    const r = await readJsonRecord(req(`{"a":"${padding}"}`));
    expect(r.kind).toBe("object");
  });
});
