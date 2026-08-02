export type BadgeId =
  | "first-ticket"
  | "clean-sweep"
  | "streak-five"
  | "twenty-five"
  | "perfect-ten";

export interface Badge {
  id: BadgeId;
  name: string;
  icon: string;
  description: string;
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
