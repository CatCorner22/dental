import { describe, expect, it } from "vitest";
import { validateSendRequest } from "./validateSendRequest";

const valid = {
  filename: "dental-note-draft-extraction",
  format: "md",
  content: "## Extraction Add-On\n- Procedure: simple extraction"
};

describe("validateSendRequest", () => {
  it("accepts a valid body", () => {
    const r = validateSendRequest(valid);
    expect(r.ok).toBe(true);
  });

  it("rejects any recipient-shaped key outright", () => {
    for (const key of ["to", "cc", "bcc", "recipient", "recipients", "email", "address", "TO"]) {
      const r = validateSendRequest({ ...valid, [key]: "attacker@example.com" });
      expect(r.ok, key).toBe(false);
      if (!r.ok) expect(r.status).toBe(400);
    }
  });

  it("rejects bad filenames, formats, and empty content", () => {
    expect(validateSendRequest({ ...valid, filename: "../etc/passwd" }).ok).toBe(false);
    expect(validateSendRequest({ ...valid, filename: "UPPER" }).ok).toBe(false);
    expect(validateSendRequest({ ...valid, format: "pdf" }).ok).toBe(false);
    expect(validateSendRequest({ ...valid, content: "  " }).ok).toBe(false);
    expect(validateSendRequest(null).ok).toBe(false);
    expect(validateSendRequest([]).ok).toBe(false);
  });

  it("rejects oversize content with 413", () => {
    const r = validateSendRequest({ ...valid, content: "x".repeat(200_001) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(413);
  });

  it("requires a written reason on the override", () => {
    expect(validateSendRequest({ ...valid, phiOverride: { confirmed: true } }).ok).toBe(false);
    expect(
      validateSendRequest({ ...valid, phiOverride: { confirmed: true, reason: "  " } }).ok
    ).toBe(false);
    const ok = validateSendRequest({
      ...valid,
      phiOverride: { confirmed: true, reason: "Reviewed each flag; all are clinical values." }
    });
    expect(ok.ok).toBe(true);
  });
});
