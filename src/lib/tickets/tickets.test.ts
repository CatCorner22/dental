import { describe, expect, it } from "vitest";
import { formatTicket } from "./ticket";
import { formatEasternTime } from "./etTime";
import { composeStamp } from "./stamp";

describe("formatTicket", () => {
  it("zero-pads to six digits with the DN- prefix", () => {
    expect(formatTicket(1)).toBe("DN-000001");
    expect(formatTicket(42)).toBe("DN-000042");
    expect(formatTicket(999999)).toBe("DN-999999");
  });
  it("widens past a million without truncating", () => {
    expect(formatTicket(1000000)).toBe("DN-1000000");
  });
  it("rejects non-positive or non-integer ids", () => {
    expect(() => formatTicket(0)).toThrow();
    expect(() => formatTicket(-3)).toThrow();
    expect(() => formatTicket(1.5)).toThrow();
  });
});

describe("formatEasternTime", () => {
  it("uses EST in winter", () => {
    // 2026-01-15 12:00 UTC -> 07:00 EST
    const s = formatEasternTime(new Date("2026-01-15T12:00:00Z"));
    expect(s).toBe("2026-01-15 07:00 EST");
  });
  it("uses EDT in summer", () => {
    // 2026-07-15 12:00 UTC -> 08:00 EDT
    const s = formatEasternTime(new Date("2026-07-15T12:00:00Z"));
    expect(s).toBe("2026-07-15 08:00 EDT");
  });
  it("handles the spring-forward boundary (2026-03-08 07:00 UTC = 02:00 EST->EDT)", () => {
    const before = formatEasternTime(new Date("2026-03-08T06:30:00Z")); // 01:30 EST
    const after = formatEasternTime(new Date("2026-03-08T07:30:00Z")); // 03:30 EDT
    expect(before).toContain("EST");
    expect(after).toContain("EDT");
    expect(before).toContain("01:30");
    expect(after).toContain("03:30");
  });
  it("handles the fall-back boundary (2026-11-01)", () => {
    const before = formatEasternTime(new Date("2026-11-01T05:30:00Z")); // 01:30 EDT
    const after = formatEasternTime(new Date("2026-11-01T06:30:00Z")); // 01:30 EST
    expect(before).toContain("EDT");
    expect(after).toContain("EST");
  });
});

describe("composeStamp", () => {
  it("renders every traceability field and the legal notice", () => {
    const block = composeStamp({
      ticket: "DN-000042",
      submittedBy: "Jane Doe (jdoe)",
      submittedAtEt: "2026-08-02 14:33 EDT",
      ruleVersion: "2.0.0",
      auditStatus: "AUDIT PASS — CLINICIAN REVIEW STILL REQUIRED"
    });
    expect(block).toContain("Ticket: DN-000042");
    expect(block).toContain("Submitted by: Jane Doe (jdoe)");
    expect(block).toContain("2026-08-02 14:33 EDT");
    expect(block).toContain("Ruleset version: 2.0.0");
    expect(block).toContain("legal and medical record");
    expect(block).toContain("no patient identifiers");
  });
});
