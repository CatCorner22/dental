import { describe, expect, it } from "vitest";
import { validateSendRequest } from "./validateSendRequest";

const valid = {
  filename: "dental-note-draft-extraction",
  format: "md",
  note: {
    selectedModuleIds: ["extraction"],
    values: {
      "extraction.procedure": { kind: "select", value: "simple extraction" },
      "extraction.teeth": { kind: "teeth", teeth: ["30"] }
    }
  }
};

describe("validateSendRequest", () => {
  it("accepts a valid structured body", () => {
    expect(validateSendRequest(valid).ok).toBe(true);
  });

  it("rejects any recipient-shaped key outright", () => {
    for (const key of ["to", "cc", "bcc", "recipient", "recipients", "email", "address", "TO"]) {
      const r = validateSendRequest({ ...valid, [key]: "attacker@example.com" });
      expect(r.ok, key).toBe(false);
      if (!r.ok) expect(r.status).toBe(400);
    }
  });

  it("rejects bad filenames and formats", () => {
    expect(validateSendRequest({ ...valid, filename: "../etc/passwd" }).ok).toBe(false);
    expect(validateSendRequest({ ...valid, filename: "UPPER" }).ok).toBe(false);
    expect(validateSendRequest({ ...valid, format: "pdf" }).ok).toBe(false);
    expect(validateSendRequest(null).ok).toBe(false);
    expect(validateSendRequest([]).ok).toBe(false);
  });

  it("rejects a malformed or empty note", () => {
    expect(validateSendRequest({ ...valid, note: "text" }).ok).toBe(false);
    expect(validateSendRequest({ ...valid, note: { selectedModuleIds: [], values: {} } }).ok).toBe(
      false
    );
    expect(
      validateSendRequest({ ...valid, note: { selectedModuleIds: ["no-such-module"], values: {} } })
        .ok
    ).toBe(false);
  });

  it("rejects field values that are not well-formed", () => {
    for (const bad of [
      { "extraction.procedure": { kind: "script", value: "x" } },
      { "extraction.procedure": { kind: "text", value: 5 } },
      { "extraction.teeth": { kind: "teeth", teeth: [30] } },
      { "extraction.m": { kind: "measurement", value: Number.POSITIVE_INFINITY, unit: "mm" } },
      { "bad key": { kind: "text", value: "x" } }
    ]) {
      const r = validateSendRequest({
        ...valid,
        note: { selectedModuleIds: ["extraction"], values: bad }
      });
      expect(r.ok, JSON.stringify(bad)).toBe(false);
    }
  });

  it("rejects prose content — the server composes the note itself", () => {
    const r = validateSendRequest({
      filename: "x",
      format: "md",
      content: "## Attacker-supplied text that never passed an audit"
    });
    expect(r.ok).toBe(false);
  });

  it("requires a written reason on the override", () => {
    expect(validateSendRequest({ ...valid, phiOverride: { confirmed: true } }).ok).toBe(false);
    expect(
      validateSendRequest({ ...valid, phiOverride: { confirmed: true, reason: "  " } }).ok
    ).toBe(false);
    expect(
      validateSendRequest({
        ...valid,
        phiOverride: { confirmed: true, reason: "Reviewed each flag; all are clinical values." }
      }).ok
    ).toBe(true);
  });
});
