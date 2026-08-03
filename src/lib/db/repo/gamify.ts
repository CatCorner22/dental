import { and, desc, eq, gt, sql } from "drizzle-orm";
import type { Db } from "../client";
import {
  pointsLedger,
  redemptions,
  storeItems,
  type RedemptionRow,
  type StoreItemRow
} from "../schema";
import { computeAward } from "@/lib/gamify/economy";

// The economy's data layer. The ledger is append-only; balances and XP are
// sums, never stored columns — a bug can misread a sum, but it cannot
// silently overwrite a career.

export async function balanceFor(db: Db, userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`coalesce(sum("delta"), 0)::int` })
    .from(pointsLedger)
    .where(eq(pointsLedger.userId, userId));
  return row?.n ?? 0;
}

export async function xpFor(db: Db, userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`coalesce(sum("delta"), 0)::int` })
    .from(pointsLedger)
    .where(and(eq(pointsLedger.userId, userId), gt(pointsLedger.delta, 0)));
  return row?.n ?? 0;
}

/**
 * Award points for a filed submission. Idempotent at the DATABASE: the
 * partial unique index on (user, ref_type, ref_id) makes a retry a no-op,
 * so a double-submit or a replayed request can never double-pay.
 * Returns the points awarded, or null when nothing was (F band or replay).
 */
export async function awardForSubmission(
  db: Db,
  args: { userId: string; submissionId: number; gpa: number; streak: number }
): Promise<number | null> {
  const xp = await xpFor(db, args.userId);
  const award = computeAward({ gpa: args.gpa, streak: args.streak, xp });
  if (award.points <= 0) return null;
  try {
    await db.insert(pointsLedger).values({
      userId: args.userId,
      delta: award.points,
      reason: `note-gpa:${award.band}${award.streakMultiplier > 1 ? ":streak" : ""}`,
      refType: "submission",
      refId: String(args.submissionId)
    });
    return award.points;
  } catch {
    // Unique-index collision: this submission already paid. Not an error.
    return null;
  }
}

/** One-time award keyed on (user, badge). Same DB-enforced idempotency. */
export async function awardOnce(
  db: Db,
  args: { userId: string; refType: string; refId: string; points: number; reason: string }
): Promise<boolean> {
  if (args.points <= 0) return false;
  try {
    await db.insert(pointsLedger).values({
      userId: args.userId,
      delta: args.points,
      reason: args.reason,
      refType: args.refType,
      refId: args.refId
    });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Store and redemptions.

export async function listStoreItems(db: Db, includeInactive = false): Promise<StoreItemRow[]> {
  const q = db.select().from(storeItems);
  const rows = includeInactive ? await q : await q.where(eq(storeItems.active, true));
  return rows.sort((a, b) => a.tier - b.tier || a.cost - b.cost);
}

export async function seedStoreIfEmpty(
  db: Db,
  items: { title: string; detail: string; cost: number; tier: number }[]
): Promise<void> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(storeItems);
  if ((row?.n ?? 0) > 0) return;
  await db.insert(storeItems).values(items);
}

export async function upsertStoreItem(
  db: Db,
  item: { id?: number; title: string; detail: string; cost: number; tier: number; active: boolean }
): Promise<StoreItemRow> {
  if (item.id) {
    const [updated] = await db
      .update(storeItems)
      .set({ title: item.title, detail: item.detail, cost: item.cost, tier: item.tier, active: item.active })
      .where(eq(storeItems.id, item.id))
      .returning();
    return updated;
  }
  const [created] = await db.insert(storeItems).values(item).returning();
  return created;
}

/**
 * Hash a user id into a 32-bit advisory-lock key. Same user always locks the
 * same key; different users almost never collide. Used to serialize spend
 * checks that are otherwise a classic read-sum-then-insert race.
 */
function userSpendLockKey(userId: string): number {
  // Stable FNV-1a 32-bit — no crypto needed; collisions only hurt throughput.
  let h = 0x811c9dc5;
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Postgres advisory locks take signed int4; keep the high bit clear.
  return h & 0x7fffffff;
}

/**
 * Request a redemption: the points leave the balance NOW (a negative ledger
 * row in the same transaction), so two simultaneous requests cannot both
 * spend the same points. A decline refunds by appending — never by deleting;
 * the ledger is a record of things that happened.
 */
export async function requestRedemption(
  db: Db,
  args: { userId: string; userName: string; itemId: number }
): Promise<{ ok: true; redemption: RedemptionRow } | { ok: false; error: string }> {
  return db.transaction(async (tx) => {
    // Serialize per-user spend: two concurrent POSTs both reading the same
    // pre-debit sum would otherwise both pass and drive the balance negative.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${userSpendLockKey(args.userId)})`);
    const [item] = await tx.select().from(storeItems).where(eq(storeItems.id, args.itemId)).limit(1);
    if (!item || !item.active) return { ok: false as const, error: "That item is not available." };
    const [bal] = await tx
      .select({ n: sql<number>`coalesce(sum("delta"), 0)::int` })
      .from(pointsLedger)
      .where(eq(pointsLedger.userId, args.userId));
    if ((bal?.n ?? 0) < item.cost) {
      return { ok: false as const, error: `That costs ${item.cost.toLocaleString()} points; the balance is ${(bal?.n ?? 0).toLocaleString()}.` };
    }
    const [redemption] = await tx
      .insert(redemptions)
      .values({
        userId: args.userId,
        userName: args.userName,
        itemId: item.id,
        itemTitle: item.title,
        cost: item.cost,
        status: "requested"
      })
      .returning();
    await tx.insert(pointsLedger).values({
      userId: args.userId,
      delta: -item.cost,
      reason: `redeem:${item.title}`,
      refType: "redemption",
      refId: String(redemption.id)
    });
    return { ok: true as const, redemption };
  });
}

export async function decideRedemption(
  db: Db,
  args: {
    id: number;
    approve: boolean;
    decidedByName: string;
    note: string;
    /** Actor deciding — used to block self-approval. */
    decidedById: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(redemptions).where(eq(redemptions.id, args.id)).limit(1);
    if (!row) return { ok: false, error: "Not found." };
    if (row.status !== "requested") return { ok: false, error: "Already decided." };
    if (row.userId === args.decidedById) {
      return {
        ok: false,
        error: "A Team Lead cannot approve or decline their own store request — ask another lead."
      };
    }
    if (!args.approve && args.note.trim().length === 0) {
      // The wish-list rule, for the same reason: a named person asked; a
      // decline with no reason teaches people to stop asking.
      return { ok: false, error: "Declining needs a short note back to the person who asked." };
    }
    // Conditional transition: only the first decider wins. Without this, two
    // concurrent declines can both append refunds, or an approve/decline race
    // can leave an approved row that was also refunded.
    const updated = await tx
      .update(redemptions)
      .set({
        status: args.approve ? "approved" : "declined",
        decidedByName: args.decidedByName,
        decidedNote: args.note.trim() || null,
        decidedAt: new Date()
      })
      .where(and(eq(redemptions.id, args.id), eq(redemptions.status, "requested")))
      .returning();
    if (updated.length === 0) return { ok: false, error: "Already decided." };
    if (!args.approve) {
      // Refund by APPENDING — the spend happened, and so did the refund.
      // Unique positive-ref index does not cover refunds; the conditional
      // update above is what makes the refund happen at most once.
      await tx.insert(pointsLedger).values({
        userId: row.userId,
        delta: row.cost,
        reason: `refund:${row.itemTitle}`,
        refType: "refund",
        refId: String(row.id)
      });
    }
    return { ok: true };
  });
}

export async function listRedemptions(db: Db, userId?: string): Promise<RedemptionRow[]> {
  const q = db.select().from(redemptions);
  const rows = userId ? await q.where(eq(redemptions.userId, userId)) : await q;
  return rows.sort(
    (a, b) =>
      (a.status === "requested" ? 0 : 1) - (b.status === "requested" ? 0 : 1) ||
      b.createdAt.getTime() - a.createdAt.getTime()
  );
}

export async function recentLedger(db: Db, userId: string, limit = 20) {
  return db
    .select()
    .from(pointsLedger)
    .where(eq(pointsLedger.userId, userId))
    .orderBy(desc(pointsLedger.createdAt), desc(pointsLedger.id))
    .limit(limit);
}
