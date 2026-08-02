import { describe, expect, it } from "vitest";
import { FIRST_PASS_STATUS, computeStats } from "./computeStats";
import { deriveBadges } from "./badges";
import { sparkleLine } from "./sparkle";

const pass = (daysAgo: number) => ({
  auditStatus: FIRST_PASS_STATUS,
  submittedAtUtc: new Date(2026, 0, 30 - daysAgo)
});
const flagged = (daysAgo: number) => ({
  auditStatus: "READY FOR CLINICIAN REVIEW",
  submittedAtUtc: new Date(2026, 0, 30 - daysAgo)
});

describe("computeStats", () => {
  it("is all-zero for no submissions", () => {
    const s = computeStats([]);
    expect(s).toMatchObject({ totalSubmitted: 0, firstPassCount: 0, firstPassRate: 0, currentStreak: 0 });
    expect(s.badges).toEqual([]);
  });
  it("counts totals and first-pass rate", () => {
    const s = computeStats([pass(3), flagged(2), pass(1)]);
    expect(s.totalSubmitted).toBe(3);
    expect(s.firstPassCount).toBe(2);
    expect(s.firstPassRate).toBeCloseTo(2 / 3);
  });
  it("counts the current streak from the newest submission back and stops at a flag", () => {
    // newest -> oldest: pass(0), pass(1), flagged(2), pass(3)
    const s = computeStats([pass(3), flagged(2), pass(1), pass(0)]);
    expect(s.currentStreak).toBe(2);
  });
  it("breaks the streak when the newest is flagged", () => {
    expect(computeStats([pass(2), pass(1), flagged(0)]).currentStreak).toBe(0);
  });
});

describe("deriveBadges", () => {
  it("awards by threshold", () => {
    expect(deriveBadges({ totalSubmitted: 0, firstPassCount: 0, currentStreak: 0 })).toEqual([]);
    expect(deriveBadges({ totalSubmitted: 1, firstPassCount: 0, currentStreak: 0 })).toEqual(["first-ticket"]);
    expect(
      deriveBadges({ totalSubmitted: 26, firstPassCount: 20, currentStreak: 10 })
    ).toEqual(["first-ticket", "clean-sweep", "streak-five", "twenty-five", "perfect-ten"]);
  });
});

describe("sparkleLine", () => {
  it("is deterministic and in range for a given seed", () => {
    expect(sparkleLine("afterSubmit", 42)).toBe(sparkleLine("afterSubmit", 42));
    expect(sparkleLine("firstPass", 0)).toMatch(/Sparkle says:/);
    expect(sparkleLine("dashboard", -7)).toMatch(/Sparkle says:/); // negative seed safe
  });
});
