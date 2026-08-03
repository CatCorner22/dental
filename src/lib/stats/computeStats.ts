import type { BadgeId } from "./badges";
import { deriveBadges } from "./badges";

// A note is "first pass" when its frozen audit status is the clean tier — no
// open S0/S1/S2 at submit time. buildReport only emits that exact string when
// counts S0..S2 are all zero, so matching it is equivalent to zero-defect.
export const FIRST_PASS_STATUS = "AUDIT PASS — CLINICIAN REVIEW STILL REQUIRED";

export interface SubmissionStatRow {
  auditStatus: string;
  submittedAtUtc: Date;
  /** When the draft behind this filing was opened. Null for rows filed before the join existed. */
  draftCreatedAtUtc?: Date | null;
}

export interface UserStats {
  totalSubmitted: number;
  firstPassCount: number;
  firstPassRate: number; // 0..1
  currentStreak: number; // consecutive first-pass, newest-first
  badges: BadgeId[];
  // ROI: the numbers that prove the tool pays for its minute. All three are
  // computed from timestamps the system already records — nothing new is
  // surveilled to produce them.
  /** Median minutes from draft opened to filed, over same-day filings only.
   *  Multi-day drafts (planned work, held notes) would swamp the median with
   *  calendar time that is not charting time. Null until there is data. */
  medianMinutesToFile: number | null;
  /** Filed outside 7am–6pm Eastern — the after-hours charting the tool exists
   *  to reduce. The practice's day, not the server's. */
  afterHoursCount: number;
  afterHoursRate: number; // 0..1
}

const ET_HOUR = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "numeric",
  hour12: false
});
const ET_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" });

function easternHour(d: Date): number {
  return parseInt(ET_HOUR.format(d), 10) % 24;
}

function isAfterHours(d: Date): boolean {
  const h = easternHour(d);
  return h < 7 || h >= 18;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function computeStats(rows: SubmissionStatRow[]): UserStats {
  const total = rows.length;
  const firstPass = rows.filter((r) => r.auditStatus === FIRST_PASS_STATUS).length;
  const ordered = [...rows].sort(
    (a, b) => b.submittedAtUtc.getTime() - a.submittedAtUtc.getTime()
  );
  let streak = 0;
  for (const r of ordered) {
    if (r.auditStatus === FIRST_PASS_STATUS) streak++;
    else break;
  }

  const sameDayMinutes: number[] = [];
  for (const r of rows) {
    if (!r.draftCreatedAtUtc) continue;
    if (ET_DAY.format(r.draftCreatedAtUtc) !== ET_DAY.format(r.submittedAtUtc)) continue;
    const minutes = (r.submittedAtUtc.getTime() - r.draftCreatedAtUtc.getTime()) / 60000;
    if (minutes >= 0) sameDayMinutes.push(minutes);
  }
  const afterHours = rows.filter((r) => isAfterHours(r.submittedAtUtc)).length;

  const stats: Omit<UserStats, "badges"> = {
    totalSubmitted: total,
    firstPassCount: firstPass,
    firstPassRate: total === 0 ? 0 : firstPass / total,
    currentStreak: streak,
    medianMinutesToFile: median(sameDayMinutes),
    afterHoursCount: afterHours,
    afterHoursRate: total === 0 ? 0 : afterHours / total
  };
  return { ...stats, badges: deriveBadges(stats) };
}
