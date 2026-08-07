import { and, desc, eq, ne, sql } from "drizzle-orm";
import type { Db } from "../client";
import { wishes, type NewWish, type WishRow } from "../schema";

export async function insertWish(db: Db, wish: NewWish): Promise<WishRow> {
  const [row] = await db.insert(wishes).values(wish).returning();
  return row;
}

// The whole list, newest first. Bounded — a wish list is small by nature, but a
// page that silently truncates is how someone's request disappears.
export async function listWishes(db: Db, limit = 500): Promise<WishRow[]> {
  return db.select().from(wishes).orderBy(desc(wishes.createdAt), desc(wishes.id)).limit(limit);
}

/**
 * Every OPEN report of something below standard, unbounded.
 *
 * Separate from the paged list on purpose, and the reason is the whole point of
 * the feature. The page sorts safety reports to the top — but it sorted the
 * TRUNCATED set, so the LIMIT ran first: enough newer wishes and an open
 * "sterilizer running cold" fell off the query before anything could rank it,
 * taking the amber banner's count to zero with it. The one mechanism designed
 * to stop a safety report being buried was computed from the buried set.
 *
 * Deliberately unbounded. These are the rows that must never be dropped, and
 * "open and below standard" is a set a working practice keeps small — if it is
 * ever large enough for a limit to matter, hiding some of it is the last thing
 * anyone should want.
 */
export async function listOpenStandardsWishes(db: Db): Promise<WishRow[]> {
  return db
    .select()
    .from(wishes)
    .where(
      and(
        eq(wishes.category, "standards"),
        ne(wishes.status, "done"),
        ne(wishes.status, "declined")
      )
    )
    .orderBy(desc(wishes.createdAt), desc(wishes.id));
}

export async function getWish(db: Db, id: number): Promise<WishRow | undefined> {
  const [row] = await db.select().from(wishes).where(eq(wishes.id, id)).limit(1);
  return row;
}

export async function updateWishStatus(
  db: Db,
  id: number,
  patch: { status: string; decidedByName: string; decidedNote: string | null; updatedAt: Date }
): Promise<WishRow | undefined> {
  const [row] = await db.update(wishes).set(patch).where(eq(wishes.id, id)).returning();
  return row;
}

export async function countWishes(db: Db): Promise<number> {
  const rows = await db.select({ n: sql<number>`count(*)::int` }).from(wishes);
  return rows[0]?.n ?? 0;
}
