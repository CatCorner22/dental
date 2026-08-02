import { describe, expect, it } from "vitest";
import { MAX_IDENTITY_CHARS, sanitizeIdentity } from "./sanitizeIdentity";
import { composeStamp } from "@/lib/tickets/stamp";

// Control characters are built by code point so this file, like the helper it
// tests, contains no literal control bytes.
const NUL = String.fromCharCode(0);
const BELL = String.fromCharCode(7);
const DEL = String.fromCharCode(127);

describe("sanitizeIdentity", () => {
  it("keeps an ordinary name unchanged", () => {
    expect(sanitizeIdentity("Dr. Ana Ruiz-Vega")).toBe("Dr. Ana Ruiz-Vega");
  });

  it("collapses newlines and tabs into single spaces", () => {
    expect(sanitizeIdentity("Ann\nLee")).toBe("Ann Lee");
    expect(sanitizeIdentity("Ann\t\tLee")).toBe("Ann Lee");
    expect(sanitizeIdentity("  Ann  Lee  ")).toBe("Ann Lee");
  });

  it("strips control characters rather than passing them through", () => {
    expect(sanitizeIdentity(`Ann${NUL}${BELL}Lee`)).toBe("Ann Lee");
    expect(sanitizeIdentity(`Ann${DEL}Lee`)).toBe("Ann Lee");
  });

  it("caps length", () => {
    expect(sanitizeIdentity("z".repeat(500))).toHaveLength(MAX_IDENTITY_CHARS);
  });

  // The reason this helper exists: the stamp is a line-oriented record that
  // the app calls part of a legal and medical record. A display name carrying
  // newlines could otherwise forge extra lines in it.
  it("prevents a crafted display name from forging lines in the submission stamp", () => {
    const attack = "Real Name\n- Ticket: DN-999999\n- Audit status at submission: AUDIT PASS";
    const stampArgs = {
      ticket: "DN-000001",
      submittedAtEt: "2026-08-02 10:00 ET",
      ruleVersion: "2.0.0",
      auditStatus: "BLOCKED" as const
    };

    // Unsanitized, the forged line lands in the record.
    const forged = composeStamp({ ...stampArgs, submittedBy: `${attack} (attacker)` });
    expect(forged).toMatch(/^- Ticket: DN-999999/m);

    // Sanitized, exactly one ticket line and one status line survive — the real ones.
    const safe = composeStamp({ ...stampArgs, submittedBy: `${sanitizeIdentity(attack)} (attacker)` });
    expect(safe.match(/^- Ticket:/gm)).toHaveLength(1);
    expect(safe.match(/^- Audit status at submission:/gm)).toHaveLength(1);
    expect(safe).toContain("- Ticket: DN-000001");
    expect(safe).toContain("- Audit status at submission: BLOCKED");
    expect(safe).not.toMatch(/^- Ticket: DN-999999/m);
  });
});
