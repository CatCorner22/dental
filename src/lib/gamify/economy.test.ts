import { describe, expect, it } from "vitest";
import { computeAward, pointsForGpa, STARTER_STORE } from "./economy";
import { rankFor, RANKS } from "./ranks";
import { deriveGpaBadges } from "@/lib/stats/badges";

describe("pointsForGpa bands", () => {
  it("matches the spec's table", () => {
    expect(pointsForGpa(4.0)).toEqual({ base: 150, band: "A" });
    expect(pointsForGpa(3.7)).toEqual({ base: 150, band: "A" });
    expect(pointsForGpa(3.69)).toEqual({ base: 75, band: "B" });
    expect(pointsForGpa(3.0)).toEqual({ base: 75, band: "B" });
    expect(pointsForGpa(2.5)).toEqual({ base: 25, band: "C" });
    expect(pointsForGpa(1.99)).toEqual({ base: 0, band: "F" });
  });
});

describe("computeAward", () => {
  it("applies the 1.5x streak multiplier to A-band work at streak 5+", () => {
    expect(computeAward({ gpa: 3.8, streak: 5, xp: 0 }).points).toBe(225);
    expect(computeAward({ gpa: 3.8, streak: 4, xp: 0 }).points).toBe(150);
    // A C-note streak never compounds — quality over volume.
    expect(computeAward({ gpa: 2.5, streak: 12, xp: 0 }).points).toBe(25);
  });

  it("applies rank bonuses", () => {
    expect(computeAward({ gpa: 3.8, streak: 0, xp: 25_000 }).points).toBe(158); // +5%
    expect(computeAward({ gpa: 3.8, streak: 0, xp: 100_000 }).points).toBe(165); // +10%
    expect(computeAward({ gpa: 3.8, streak: 0, xp: 500_000 }).points).toBe(180); // 1.2x
  });

  it("an F earns nothing, whatever the streak or rank", () => {
    expect(computeAward({ gpa: 1.5, streak: 20, xp: 500_000 }).points).toBe(0);
  });
});

describe("ranks", () => {
  it("thresholds ascend and titles match the spec", () => {
    for (let i = 1; i < RANKS.length; i++) {
      expect(RANKS[i].minXp).toBeGreaterThan(RANKS[i - 1].minXp);
    }
    expect(rankFor(0).rank.title).toBe("Charting Apprentice");
    expect(rankFor(5_000).rank.title).toBe("Clinical Scribe");
    expect(rankFor(499_999).rank.title).toBe("Documentation Legend");
    expect(rankFor(500_000).rank.title).toBe("Grandmaster of the Chart");
  });

  it("progress runs 0..1 toward the next rank and pins at the top", () => {
    const p = rankFor(15_000);
    expect(p.rank.title).toBe("Clinical Scribe");
    expect(p.progress).toBeCloseTo(0.5);
    expect(rankFor(600_000).progress).toBe(1);
    expect(rankFor(600_000).next).toBeNull();
  });
});

describe("starter store", () => {
  it("tiers ascend in cost", () => {
    for (let i = 1; i < STARTER_STORE.length; i++) {
      expect(STARTER_STORE[i].cost).toBeGreaterThan(STARTER_STORE[i - 1].cost);
    }
  });
});

describe("GPA badges", () => {
  const day = (offset: number, gpa: string, consistency = 1, justification = 1) => ({
    submittedAtUtc: new Date(Date.UTC(2026, 0, 1 + offset, 17, 0, 0)),
    gpa,
    gpaSubscores: { completeness: 1, specificity: 1, consistency, justification }
  });

  it("flawless week needs five consecutive 3.8+ filing days", () => {
    const rows = [0, 1, 2, 3, 4].map((i) => day(i, "3.90"));
    expect(deriveGpaBadges(rows)).toContain("flawless-week");
    // A bad day in the middle breaks the run.
    const broken = [day(0, "3.9"), day(1, "3.9"), day(2, "2.0"), day(3, "3.9"), day(4, "3.9")];
    expect(deriveGpaBadges(broken)).not.toContain("flawless-week");
  });

  it("golden syringe needs fifty consecutive perfect-consistency filings", () => {
    const fifty = Array.from({ length: 50 }, (_, i) => day(i, "3.50", 1));
    expect(deriveGpaBadges(fifty)).toContain("golden-syringe");
    const brokenRun = [...fifty.slice(0, 25), day(25, "3.5", 0.75), ...fifty.slice(26)];
    expect(deriveGpaBadges(brokenRun)).not.toContain("golden-syringe");
  });

  it("century mark counts filings", () => {
    const hundred = Array.from({ length: 100 }, (_, i) => day(Math.floor(i / 4), "3.00"));
    expect(deriveGpaBadges(hundred)).toContain("century-mark");
    expect(deriveGpaBadges(hundred.slice(0, 99))).not.toContain("century-mark");
  });
});
