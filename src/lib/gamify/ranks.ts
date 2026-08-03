// Lifetime ranks. XP is lifetime points EARNED (never reduced by spending),
// so a rank is a fact about someone's body of work — the store cannot demote
// anyone, and neither can a manager.

export interface Rank {
  title: string;
  minXp: number;
  /** Multiplied into every award while the rank is held. */
  pointBonus: number; // 0.05 = +5%
  perk: string;
}

export const RANKS: Rank[] = [
  { title: "Charting Apprentice", minXp: 0, pointBonus: 0, perk: "Access to basic store items" },
  { title: "Clinical Scribe", minXp: 5_000, pointBonus: 0, perk: "Custom UI color themes" },
  { title: "Precision Specialist", minXp: 25_000, pointBonus: 0.05, perk: "Specialist profile badge, +5% points" },
  { title: "Master Chart Auditor", minXp: 100_000, pointBonus: 0.1, perk: "Platinum nameplate, +10% points" },
  {
    title: "Documentation Legend",
    minXp: 250_000,
    pointBonus: 0.1,
    // The spec's "custom wake word" perk is audio, which this platform does
    // not do (gated decision). A Legend gets a custom theme and their wishes
    // reviewed first instead — a perk the platform can actually honor.
    perk: "Custom theme, priority wish-list review, +10% points"
  },
  {
    title: "Grandmaster of the Chart",
    minXp: 500_000,
    pointBonus: 0.2,
    perk: "Real-world clinic plaque (fulfilled by the practice), permanent 1.2x awards"
  }
];

export interface RankProgress {
  rank: Rank;
  /** Next rank, or null at the top. */
  next: Rank | null;
  /** 0..1 progress from this rank's floor to the next one's. */
  progress: number;
}

export function rankFor(xp: number): RankProgress {
  let idx = 0;
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (xp >= RANKS[i].minXp) {
      idx = i;
      break;
    }
  }
  const rank = RANKS[idx];
  const next = RANKS[idx + 1] ?? null;
  const progress = next
    ? Math.max(0, Math.min(1, (xp - rank.minXp) / (next.minXp - rank.minXp)))
    : 1;
  return { rank, next, progress };
}
