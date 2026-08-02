import type { BadgeId } from "./badges";
import { deriveBadges } from "./badges";

// A note is "first pass" when its frozen audit status is the clean tier — no
// open S0/S1/S2 at submit time. buildReport only emits that exact string when
// counts S0..S2 are all zero, so matching it is equivalent to zero-defect.
export const FIRST_PASS_STATUS = "AUDIT PASS — CLINICIAN REVIEW STILL REQUIRED";

export interface SubmissionStatRow {
  auditStatus: string;
  submittedAtUtc: Date;
}

export interface UserStats {
  totalSubmitted: number;
  firstPassCount: number;
  firstPassRate: number; // 0..1
  currentStreak: number; // consecutive first-pass, newest-first
  badges: BadgeId[];
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
  const stats: Omit<UserStats, "badges"> = {
    totalSubmitted: total,
    firstPassCount: firstPass,
    firstPassRate: total === 0 ? 0 : firstPass / total,
    currentStreak: streak
  };
  return { ...stats, badges: deriveBadges(stats) };
}
