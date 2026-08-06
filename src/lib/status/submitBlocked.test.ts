import { describe, expect, it } from "vitest";

import { submitBlockedReason } from "./submitBlocked";
import type { Severity } from "@/lib/audit/types";

const counts = (over: Partial<Record<Severity, number>> = {}): Record<Severity, number> => ({
  S0: 0,
  S1: 0,
  S2: 0,
  S3: 0,
  S4: 0,
  ...over
});

describe("what the disabled Submit says", () => {
  it("does not report a count of zero as a second thing to do", () => {
    // The bug. Blocked by a stop alone, the line read "1 to fix; 0 required
    // fields still open" — and the one line whose entire job is to say what to
    // do next spent half of itself on something there was none of.
    const out = submitBlockedReason(counts({ S0: 1 }));
    expect(out).toContain("1 to fix");
    expect(out).not.toContain("0 required");
  });

  it("says only the required fields when there is no stop", () => {
    const out = submitBlockedReason(counts({ S1: 3 }));
    expect(out).toContain("3 required fields still open");
    expect(out).not.toContain("to fix");
  });

  it("says both when both are open", () => {
    const out = submitBlockedReason(counts({ S0: 2, S1: 1 }));
    expect(out).toContain("2 to fix");
    expect(out).toContain("1 required field still open");
  });

  it("counts one required field in the singular", () => {
    expect(submitBlockedReason(counts({ S1: 1 }))).toContain("1 required field still");
  });

  it("ignores the severities that do not block filing", () => {
    // computeGates blocks export on S0 and email on S0+S1. S2 and below are
    // advice, and naming them here would describe a note as blocked when the
    // Submit button beside this sentence is enabled.
    expect(submitBlockedReason(counts({ S2: 9, S3: 4, S4: 2 }))).toBe("");
  });

  it("says nothing at all when nothing blocks", () => {
    expect(submitBlockedReason(counts())).toBe("");
  });
});
