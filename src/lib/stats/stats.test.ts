import { describe, expect, it } from "vitest";
import { FIRST_PASS_STATUS, computeStats } from "./computeStats";
import { deriveBadges } from "./badges";
import { ALL_SPARKLE_LINES, daySeed, sparkleLine, type SparkleContext } from "./sparkle";

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
    expect(sparkleLine("empty", 3)).toMatch(/Sparkle says:/);
    expect(sparkleLine("conflict", 3)).toMatch(/Sparkle says:/);
  });

  it("answers for every context, so a new one cannot ship empty", () => {
    // The modulo in sparkleLine divides by lines.length. A context added with
    // an empty array does not throw — it returns undefined and renders as
    // nothing, which is exactly the kind of miss that survives a code review.
    const contexts: SparkleContext[] = [
      "dashboard",
      "afterSubmit",
      "firstPass",
      "empty",
      "conflict",
      "paste",
      "resolving",
      "scoped",
      "saved",
      "history",
      "signIn",
      "lost",
      "batch",
      "training"
    ];
    for (const context of contexts) {
      // Two different seeds: a single-line context would pass a one-seed check
      // while still having nothing to rotate.
      expect(sparkleLine(context, 0), context).toMatch(/^Sparkle says:/);
      expect(sparkleLine(context, 1), context).toMatch(/^Sparkle says:/);
    }
  });

  it("daySeed is stable within a day and advances the next day", () => {
    const morning = new Date("2026-08-02T00:10:00Z");
    const evening = new Date("2026-08-02T23:50:00Z");
    const tomorrow = new Date("2026-08-03T00:10:00Z");
    expect(daySeed(morning)).toBe(daySeed(evening));
    expect(daySeed(tomorrow)).toBe(daySeed(morning) + 1);
  });
});

describe("sparkle copy quality (ethics guard)", () => {
  it("never lectures, corrects, or pressures", () => {
    // Supportive and encouraging only. These markers signal lecturing or
    // negative framing, and no line may ever contain them.
    const banned = [
      "you should",
      "you must",
      "you need to",
      "remember to",
      "don't",
      "do not",
      "never ",
      "always ",
      "etc",
      "fail",
      "wrong",
      "bad ",
      "blame"
    ];
    for (const line of ALL_SPARKLE_LINES) {
      const lower = line.toLowerCase();
      for (const marker of banned) {
        expect(lower.includes(marker), `"${line}" contains "${marker.trim()}"`).toBe(false);
      }
    }
  });

  it("stays brief and visibly comes from the mascot", () => {
    for (const line of ALL_SPARKLE_LINES) {
      expect(line.startsWith("Sparkle says:"), line).toBe(true);
      expect(line.length, line).toBeLessThanOrEqual(90);
    }
  });

  it("compares nobody — no singling out of people or performance", () => {
    for (const line of ALL_SPARKLE_LINES) {
      const lower = line.toLowerCase();
      for (const marker of ["best ", "worst", "faster than", "behind", "rank"]) {
        expect(lower.includes(marker), `"${line}" contains "${marker.trim()}"`).toBe(false);
      }
    }
  });

  it("stays PG and kind — no harsh or edgy words", () => {
    const banned = [
      /\bdamn/,
      /\bhell\b/,
      /\bcrap/,
      /\bsuck/,
      /\bstupid/,
      /\bdumb\b/,
      /\bhate\b/,
      /\bkill/,
      /\bdead\b/,
      /\bscrew/
    ];
    for (const line of ALL_SPARKLE_LINES) {
      const lower = line.toLowerCase();
      for (const marker of banned) {
        expect(marker.test(lower), `"${line}" matches ${marker}`).toBe(false);
      }
    }
  });

  it("uses warm, everyday words — no military or drill-team flavor", () => {
    // Team lines say "we" and "team", never command-culture words like
    // "chain", "in step", or "standard-issue". Word-boundary regexes so
    // ordinary words (e.g. "submission") never false-positive.
    const banned = [
      /\bchain/,
      /\bin step\b/,
      /standard-issue/,
      /\bsoldier/,
      /\bbattle/,
      /\bdrill/,
      /\bmission\b/,
      /\btroop/,
      /\bcombat\b/,
      /\bwarrior/,
      /\bcommand/,
      /\bmarch/,
      /\brecruit/,
      /\bsquad\b/
    ];
    for (const line of ALL_SPARKLE_LINES) {
      const lower = line.toLowerCase();
      for (const marker of banned) {
        expect(marker.test(lower), `"${line}" matches ${marker}`).toBe(false);
      }
    }
  });
});

describe("ROI metrics", () => {
  const at = (iso: string) => new Date(iso);
  const row = (submitted: string, created: string | null, status = FIRST_PASS_STATUS) => ({
    auditStatus: status,
    submittedAtUtc: at(submitted),
    draftCreatedAtUtc: created ? at(created) : null
  });

  it("median time-to-file counts same-ET-day filings only", () => {
    const s = computeStats([
      // 30 minutes, same day (ET afternoon)
      row("2026-08-03T18:30:00Z", "2026-08-03T18:00:00Z"),
      // 90 minutes, same day
      row("2026-08-03T19:30:00Z", "2026-08-03T18:00:00Z"),
      // multi-day draft: excluded, would otherwise swamp the median
      row("2026-08-03T18:00:00Z", "2026-07-28T18:00:00Z"),
      // no draft timestamp: excluded
      row("2026-08-03T18:00:00Z", null)
    ]);
    expect(s.medianMinutesToFile).toBe(60);
  });

  it("is null with no measurable rows", () => {
    expect(computeStats([row("2026-08-03T18:00:00Z", null)]).medianMinutesToFile).toBeNull();
  });

  it("counts after-hours filings on the Eastern clock, not the server's", () => {
    const s = computeStats([
      row("2026-08-03T18:00:00Z", null), // 2:00 pm ET — business hours
      row("2026-08-04T00:30:00Z", null), // 8:30 pm ET — after hours
      row("2026-08-03T10:30:00Z", null) // 6:30 am ET — before hours
    ]);
    expect(s.afterHoursCount).toBe(2);
    expect(s.afterHoursRate).toBeCloseTo(2 / 3);
  });
});
