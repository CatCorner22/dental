import { rankFor } from "./ranks";

// The award math, pure and inspectable. Every number here is on the wish
// list's side of the trust equation: staff can read this file (or the
// reference page derived from it) and verify the economy pays what it says.

export interface AwardInput {
  gpa: number;
  /** Consecutive first-pass filings INCLUDING this one, newest-first. */
  streak: number;
  /** Lifetime XP before this award. */
  xp: number;
}

export interface AwardResult {
  points: number;
  base: number;
  streakMultiplier: number;
  rankBonus: number;
  band: "A" | "B" | "C" | "F";
}

export function pointsForGpa(gpa: number): { base: number; band: AwardResult["band"] } {
  if (gpa >= 3.7) return { base: 150, band: "A" };
  if (gpa >= 3.0) return { base: 75, band: "B" };
  if (gpa >= 2.0) return { base: 25, band: "C" };
  return { base: 0, band: "F" };
}

export function computeAward(input: AwardInput): AwardResult {
  const { base, band } = pointsForGpa(input.gpa);
  // The streak multiplier applies to A-band work only — a streak of C notes
  // compounding would reward volume over quality, the exact inversion of the
  // point.
  const streakMultiplier = band === "A" && input.streak >= 5 ? 1.5 : 1;
  const { rank } = rankFor(input.xp);
  const rankBonus = rank.pointBonus;
  const points = Math.round(base * streakMultiplier * (1 + rankBonus));
  return { points, base, streakMultiplier, rankBonus, band };
}

// The starter store, seeded once when the table is empty. Tiers follow the
// training spec; every item is fulfilled by the PRACTICE (the app tracks the
// request and the decision, never the coffee).
export const STARTER_STORE: { title: string; detail: string; cost: number; tier: number }[] = [
  { title: "Premium coffee or snack", detail: "From the breakroom stash.", cost: 500, tier: 1 },
  { title: "Choose the operatory playlist", detail: "One week of musical authority.", cost: 1500, tier: 2 },
  { title: "Embroidered clinic fleece or scrub top", detail: "Custom order.", cost: 5000, tier: 3 },
  { title: "$100 local restaurant or spa gift card", detail: "Fulfilled by the practice.", cost: 15000, tier: 4 },
  { title: "Half-day paid wellness leave", detail: "A Friday afternoon, approved by the lead.", cost: 35000, tier: 5 }
];
