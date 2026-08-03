export type BadgeId =
  | "first-ticket"
  | "clean-sweep"
  | "streak-five"
  | "twenty-five"
  | "perfect-ten"
  | "century-mark"
  | "marathon-scribe"
  | "flawless-week"
  | "iron-mountain"
  | "golden-syringe"
  | "the-architect";

export interface Badge {
  id: BadgeId;
  name: string;
  icon: string;
  description: string;
  /** One-time point bonus paid when the badge is first earned. */
  bonus?: number;
}

export const BADGES: Record<BadgeId, Badge> = {
  "first-ticket": {
    id: "first-ticket",
    name: "First Ticket",
    icon: "🎫",
    description: "Submitted your first standardized note."
  },
  "clean-sweep": {
    id: "clean-sweep",
    name: "Clean Sweep",
    icon: "✨",
    description: "Submitted a note that passed the audit on the first try."
  },
  "streak-five": {
    id: "streak-five",
    name: "Streak of Five",
    icon: "🔥",
    description: "Five clean submissions in a row."
  },
  "twenty-five": {
    id: "twenty-five",
    name: "Twenty-Five Club",
    icon: "🏆",
    description: "Submitted twenty-five notes."
  },
  "perfect-ten": {
    id: "perfect-ten",
    name: "Perfect Ten",
    icon: "💎",
    description: "Ten clean submissions in a row."
  },
  "century-mark": {
    id: "century-mark",
    name: "The Century Mark",
    icon: "💯",
    description: "One hundred filed notes.",
    bonus: 500
  },
  "marathon-scribe": {
    id: "marathon-scribe",
    name: "Marathon Scribe",
    icon: "🏃",
    description: "One thousand filed notes.",
    bonus: 2500
  },
  "flawless-week": {
    id: "flawless-week",
    name: "The Flawless Week",
    icon: "🌟",
    description: "A 3.8+ average GPA across five consecutive filing days.",
    bonus: 1000
  },
  "iron-mountain": {
    id: "iron-mountain",
    name: "Iron Mountain",
    icon: "⛰️",
    description: "Thirty consecutive filing days without a failing note.",
    bonus: 3000
  },
  "golden-syringe": {
    id: "golden-syringe",
    name: "The Golden Syringe",
    icon: "💉",
    description: "Fifty consecutive filings with a perfect consistency score.",
    bonus: 1500
  },
  "the-architect": {
    id: "the-architect",
    name: "The Architect",
    icon: "🏛️",
    description: "One hundred filings with a perfect billing-narrative score.",
    bonus: 1500
  }
};

export function deriveBadges(stats: {
  totalSubmitted: number;
  firstPassCount: number;
  currentStreak: number;
}): BadgeId[] {
  const earned: BadgeId[] = [];
  if (stats.totalSubmitted >= 1) earned.push("first-ticket");
  if (stats.firstPassCount >= 1) earned.push("clean-sweep");
  if (stats.currentStreak >= 5) earned.push("streak-five");
  if (stats.totalSubmitted >= 25) earned.push("twenty-five");
  if (stats.currentStreak >= 10) earned.push("perfect-ten");
  return earned;
}

// The long-arc badges, derived from GPA-stamped filings.
//
// Honest divergences from the training spec, stated here rather than
// discovered later:
//  - "Iron Mountain" is thirty consecutive FILING days with no F note; the
//    spec's "no pending/unsigned notes" needs draft-state history the system
//    does not keep per-day.
//  - "The Golden Syringe" uses the consistency subscore as its proxy for
//    perfect anesthetic documentation — the subscore is 1.0 only when no
//    medication-safety or anatomy finding survived to filing.
//  - "The Detective" (catching unjustified codes) needs per-finding fix
//    telemetry that is not persisted; it ships when that does.

export interface GpaStatRow {
  submittedAtUtc: Date;
  gpa: string | null;
  gpaSubscores: Record<string, number> | null;
}

const ET_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" });

export function deriveGpaBadges(rows: GpaStatRow[]): BadgeId[] {
  const earned: BadgeId[] = [];
  if (rows.length >= 100) earned.push("century-mark");
  if (rows.length >= 1000) earned.push("marathon-scribe");

  // Group graded rows by Eastern filing day, oldest day first.
  const byDay = new Map<string, number[]>();
  for (const r of rows) {
    if (r.gpa === null) continue;
    const day = ET_DAY.format(r.submittedAtUtc);
    const list = byDay.get(day) ?? [];
    list.push(parseFloat(r.gpa));
    byDay.set(day, list);
  }
  const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));

  // Flawless week: five consecutive FILING days (calendar gaps between them
  // do not matter — a weekend is not a lapse) with a 3.8+ day average.
  let flawlessRun = 0;
  // Iron Mountain: thirty consecutive filing days with no F (< 2.0) note.
  let ironRun = 0;
  for (const [, gpas] of days) {
    const avg = gpas.reduce((a, b) => a + b, 0) / gpas.length;
    flawlessRun = avg >= 3.8 ? flawlessRun + 1 : 0;
    ironRun = gpas.every((g) => g >= 2.0) ? ironRun + 1 : 0;
    if (flawlessRun >= 5) earned.push("flawless-week");
    if (ironRun >= 30) earned.push("iron-mountain");
    if (earned.includes("flawless-week") && earned.includes("iron-mountain")) break;
  }

  // Golden Syringe: fifty consecutive filings with consistency exactly 1.
  const ordered = [...rows].sort(
    (a, b) => a.submittedAtUtc.getTime() - b.submittedAtUtc.getTime()
  );
  let syringeRun = 0;
  for (const r of ordered) {
    const c = r.gpaSubscores?.consistency;
    syringeRun = c === 1 ? syringeRun + 1 : 0;
    if (syringeRun >= 50) {
      earned.push("golden-syringe");
      break;
    }
  }

  // The Architect: one hundred filings with a perfect justification score.
  const architected = rows.filter((r) => r.gpaSubscores?.justification === 1).length;
  if (architected >= 100) earned.push("the-architect");

  return [...new Set(earned)];
}
