import { describe, expect, it } from "vitest";
import { STATUS_META, deriveDraftStatus } from "./draftStatus";
import type { Severity } from "@/lib/audit/types";

const counts = (over: Partial<Record<Severity, number>> = {}): Record<Severity, number> => ({
  S0: 0,
  S1: 0,
  S2: 0,
  S3: 0,
  S4: 0,
  ...over
});

describe("deriveDraftStatus", () => {
  it("submitted and error take precedence over everything", () => {
    expect(
      deriveDraftStatus({ hasContent: true, counts: counts({ S0: 3 }), phiStops: 0, submitted: true, lastSendFailed: false })
    ).toBe("submitted");
    expect(
      deriveDraftStatus({ hasContent: true, counts: counts({ S0: 3 }), phiStops: 0, submitted: false, lastSendFailed: true })
    ).toBe("error");
  });
  it("empty content is unfinished", () => {
    expect(
      deriveDraftStatus({ hasContent: false, counts: counts(), phiStops: 0, submitted: false, lastSendFailed: false })
    ).toBe("unfinished");
  });
  it("maps severities to the right chip", () => {
    const base = { hasContent: true, phiStops: 0, submitted: false, lastSendFailed: false };
    expect(deriveDraftStatus({ ...base, counts: counts({ S0: 1 }) })).toBe("blocked");
    expect(deriveDraftStatus({ ...base, counts: counts({ S1: 1 }) })).toBe("action-needed");
    expect(deriveDraftStatus({ ...base, counts: counts({ S2: 1 }) })).toBe("review");
    expect(deriveDraftStatus({ ...base, counts: counts({ S3: 5, S4: 5 }) })).toBe("ready");
    expect(deriveDraftStatus({ ...base, counts: counts() })).toBe("ready");
  });
  it("a privacy stop outranks the generic block", () => {
    // The counts alone cannot tell a wrong-site stop from a privacy stop, and
    // those demand different action: fix the field, versus get the identifier
    // out of the practice database. When both are true the identifier at rest
    // is the more urgent fact, so the chip says Privacy.
    const base = { hasContent: true, submitted: false, lastSendFailed: false };
    expect(deriveDraftStatus({ ...base, counts: counts({ S0: 2 }), phiStops: 1 })).toBe("phi");
    expect(deriveDraftStatus({ ...base, counts: counts({ S0: 2 }), phiStops: 0 })).toBe("blocked");
    // Submitted still wins: the filed record already carries the attestation.
    expect(
      deriveDraftStatus({ ...base, counts: counts({ S0: 1 }), phiStops: 1, submitted: true })
    ).toBe("submitted");
  });
  it("has metadata for every status with a non-color label and icon", () => {
    for (const status of [
      "unfinished",
      "phi",
      "blocked",
      "action-needed",
      "review",
      "ready",
      "submitted",
      "error"
    ] as const) {
      const meta = STATUS_META[status];
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.icon.length).toBeGreaterThan(0);
    }
  });
});
