// The wish list, as a pure module: categories, statuses, and validation.
//
// The design principle, and the reason this looks nothing like the Data Hygiene
// Gauntlet: FRICTION IS THE ENEMY HERE.
//
// The Gauntlet is hard on purpose because a schema change is expensive and
// permanent, so making someone argue for it is the feature. A wish is the
// opposite trade. The cost of a bad suggestion is that a manager reads one
// sentence and moves on. The cost of a suppressed observation — a sterilizer
// running cold, a glove box empty, a room nobody has cleaned — is unbounded and
// lands on a patient.
//
// So this validates only what makes a wish USABLE (is there a real sentence in
// it?), never whether it is a good idea. Judging that is the reader's job.

export type WishCategory =
  | "standards"
  | "rule-disagreement"
  | "supply"
  | "feature"
  | "performance"
  | "other";

export interface CategoryDef {
  id: WishCategory;
  label: string;
  hint: string;
  /** Sorted to the top of the list and visually distinct. */
  urgent?: boolean;
}

export const WISH_CATEGORIES: CategoryDef[] = [
  {
    id: "standards",
    label: "Something is below standard",
    hint: "A condition, a process, or equipment that is not where it should be. Say what you saw and where — you do not need to be certain, and you do not need to have a solution.",
    urgent: true
  },
  // The escape valve that keeps "no override" honest. The tool never lets a
  // user force a note past a rule they merely dislike — but a rule can be
  // wrong, and the person who sees that first is the person it just blocked.
  // Their disagreement goes here, named and reasoned, for a Team Lead to
  // settle. The rule stays in force until someone with authority says
  // otherwise; the disagreement is never silently swallowed.
  {
    id: "rule-disagreement",
    label: "I disagree with a Smile Notes rule",
    hint: "A rule flagged something you believe is correct as written. Name the rule, quote nothing from the patient note, and say why the rule is wrong or too broad. A Team Lead settles it."
  },
  {
    id: "supply",
    label: "Supply request",
    hint: "Something we are out of, running low on, or need a different version of."
  },
  {
    id: "feature",
    label: "New feature for Smile Notes",
    hint: "Something the app should be able to do that it cannot do today."
  },
  {
    id: "performance",
    label: "Make something faster or easier",
    hint: "A step that takes too long, too many clicks, or too much re-typing."
  },
  {
    id: "other",
    label: "Something else",
    hint: "Anything that does not fit the categories above."
  }
];

export const CATEGORY_LABEL: Record<WishCategory, string> = Object.fromEntries(
  WISH_CATEGORIES.map((c) => [c.id, c.label])
) as Record<WishCategory, string>;

export function isWishCategory(v: unknown): v is WishCategory {
  return typeof v === "string" && WISH_CATEGORIES.some((c) => c.id === v);
}

// Statuses a Team Lead or above can move a wish through. "Declined" always
// carries a note — a wish list where things silently die stops being used, and
// the person who raised it is named, so they deserve an answer.
export type WishStatus = "new" | "looking" | "planned" | "done" | "declined";

export const WISH_STATUSES: { id: WishStatus; label: string; blurb: string }[] = [
  { id: "new", label: "New", blurb: "Not looked at yet." },
  { id: "looking", label: "Looking into it", blurb: "Someone is finding out more." },
  { id: "planned", label: "Planned", blurb: "Agreed, and it is going to happen." },
  { id: "done", label: "Done", blurb: "Sorted." },
  { id: "declined", label: "Not doing this", blurb: "Decided against, with a reason." }
];

export const STATUS_LABEL: Record<WishStatus, string> = Object.fromEntries(
  WISH_STATUSES.map((s) => [s.id, s.label])
) as Record<WishStatus, string>;

export function isWishStatus(v: unknown): v is WishStatus {
  return typeof v === "string" && WISH_STATUSES.some((s) => s.id === v);
}

export const WISH_TITLE_MAX = 140;
export const WISH_DETAIL_MAX = 4000;
export const WISH_NOTE_MAX = 1000;

export interface WishInput {
  category: unknown;
  title: unknown;
  detail: unknown;
}

/**
 * Validate a wish. Returns an error string, or null when it is fine.
 *
 * The bar is deliberately at the floor: a real category and a title with actual
 * words in it. No length essay, no justification, no checklist. Anything more
 * would be asking someone to argue for a suggestion, which is exactly how a
 * suggestion box goes quiet.
 */
export function wishError(input: WishInput): string | null {
  if (!isWishCategory(input.category)) return "Pick a category.";
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title) return "Say what it is in one line.";
  // Two words, not a character count: "x" and "asdf" are noise, but a genuinely
  // short "gloves out" is a perfectly good supply request.
  if (title.split(/\s+/).filter((w) => w.length > 1).length < 2) {
    return "Add a couple more words so someone reading the list knows what you mean.";
  }
  if (title.length > WISH_TITLE_MAX) {
    return `Keep the one-liner under ${WISH_TITLE_MAX} characters — the detail box below has room.`;
  }
  const detail = typeof input.detail === "string" ? input.detail : "";
  if (detail.length > WISH_DETAIL_MAX) {
    return `The detail is over ${WISH_DETAIL_MAX.toLocaleString()} characters. Trim it or attach the rest another way.`;
  }
  return null;
}

/**
 * Drift signal for the people who decide: which rules are being disputed, and
 * how the disputes were settled. A rule with many open disagreements is either
 * a rule that needs tuning or a team that needs the rule explained — either
 * way, the person with authority should see the pattern, not just the pile.
 * This is the calibration half of "no override": escalations are not noise to
 * clear, they are the tool's own error signal.
 */
export interface RuleDisagreementStat {
  rule: string;
  open: number;
  settled: number;
}

const RULE_TITLE_PREFIX = /^rule disagreement:\s*/i;

export function ruleDisagreementStats<
  T extends { category: string; status: string; title: string }
>(rows: T[]): RuleDisagreementStat[] {
  const byRule = new Map<string, { open: number; settled: number }>();
  for (const row of rows) {
    if (row.category !== "rule-disagreement") continue;
    const rule = row.title.replace(RULE_TITLE_PREFIX, "").trim() || "(unnamed rule)";
    const bucket = byRule.get(rule) ?? { open: 0, settled: 0 };
    if (row.status === "done" || row.status === "declined") bucket.settled++;
    else bucket.open++;
    byRule.set(rule, bucket);
  }
  return [...byRule.entries()]
    .map(([rule, counts]) => ({ rule, ...counts }))
    .sort((a, b) => b.open - a.open || b.settled - a.settled || a.rule.localeCompare(b.rule));
}

/**
 * Sort for display: anything below standard first (regardless of age), then
 * newest. A safety observation must never be pushed off the bottom of the page
 * by a pile of feature ideas.
 */
export function sortWishes<T extends { category: string; status: string; createdAt: Date }>(
  rows: T[]
): T[] {
  const rank = (w: T) => {
    if (w.category === "standards" && w.status !== "done" && w.status !== "declined") return 0;
    return 1;
  };
  return [...rows].sort(
    (a, b) => rank(a) - rank(b) || b.createdAt.getTime() - a.createdAt.getTime()
  );
}
