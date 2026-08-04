import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../client";
import { userBlocks, type UserBlockRow } from "../schema";

// Personal saved blocks. Every function takes the OWNER — there is no
// cross-user read or write path at the repo layer, so a route bug cannot
// leak one writer's templates to another.

const MAX_BLOCKS_PER_USER = 30;

export async function listUserBlocks(db: Db, ownerId: string): Promise<UserBlockRow[]> {
  return db
    .select()
    .from(userBlocks)
    .where(eq(userBlocks.ownerId, ownerId))
    .orderBy(desc(userBlocks.createdAt), desc(userBlocks.id))
    .limit(MAX_BLOCKS_PER_USER);
}

export async function countUserBlocks(db: Db, ownerId: string): Promise<number> {
  return (await db.select({ id: userBlocks.id }).from(userBlocks).where(eq(userBlocks.ownerId, ownerId)))
    .length;
}

export async function insertUserBlock(
  db: Db,
  ownerId: string,
  title: string,
  body: string
): Promise<UserBlockRow | null> {
  if ((await countUserBlocks(db, ownerId)) >= MAX_BLOCKS_PER_USER) return null;
  const [row] = await db.insert(userBlocks).values({ ownerId, title, body }).returning();
  return row ?? null;
}

/** Deletes only when the row belongs to the caller; returns whether it did. */
export async function deleteUserBlock(db: Db, ownerId: string, id: number): Promise<boolean> {
  const rows = await db
    .delete(userBlocks)
    .where(and(eq(userBlocks.id, id), eq(userBlocks.ownerId, ownerId)))
    .returning();
  return rows.length > 0;
}

export { MAX_BLOCKS_PER_USER };
