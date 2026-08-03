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

export type WishCategory = "standards" | "supply" | "feature" | "performance" | "other";

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
