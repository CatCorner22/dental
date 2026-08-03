import { desc, eq } from "drizzle-orm";
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
  return (await db.select().from(wishes)).length;
}
