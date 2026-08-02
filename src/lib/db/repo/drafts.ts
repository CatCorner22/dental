import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../client";
import { drafts, submissions, type DraftRow, type NewDraft } from "../schema";

export async function insertDraft(db: Db, draft: NewDraft): Promise<DraftRow> {
  const [row] = await db.insert(drafts).values(draft).returning();
  return row;
}

export async function getDraft(db: Db, id: string): Promise<DraftRow | undefined> {
  const [row] = await db.select().from(drafts).where(eq(drafts.id, id)).limit(1);
  return row;
}

export async function listAllDrafts(db: Db): Promise<DraftRow[]> {
  return db.select().from(drafts).orderBy(drafts.updatedAt);
}

export async function listDraftsByOwner(db: Db, ownerId: string): Promise<DraftRow[]> {
  return db.select().from(drafts).where(eq(drafts.ownerId, ownerId)).orderBy(drafts.updatedAt);
}

// Optimistic-concurrency update: only applies when the caller's baseVersion
// matches the stored version, then bumps it. Returns undefined on a stale write.
export async function updateDraftChecked(
  db: Db,
  id: string,
  baseVersion: number,
  patch: Partial<Pick<DraftRow, "title" | "noteState" | "status" | "lastSendFailed">>,
  now: Date
): Promise<DraftRow | undefined> {
  const [row] = await db
    .update(drafts)
    .set({ ...patch, version: baseVersion + 1, updatedAt: now })
    .where(and(eq(drafts.id, id), eq(drafts.version, baseVersion)))
    .returning();
  return row;
}

export async function setDraftStatus(
  db: Db,
  id: string,
  status: string,
  lastSendFailed: boolean
): Promise<void> {
  await db.update(drafts).set({ status, lastSendFailed }).where(eq(drafts.id, id));
}

export async function transferDraft(db: Db, id: string, toUserId: string, now: Date): Promise<void> {
  await db.update(drafts).set({ ownerId: toUserId, updatedAt: now }).where(eq(drafts.id, id));
}

export async function draftSubmissionCount(db: Db, id: string): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(submissions)
    .where(eq(submissions.draftId, id));
  return rows[0]?.n ?? 0;
}

export async function deleteDraft(db: Db, id: string): Promise<void> {
  await db.delete(drafts).where(eq(drafts.id, id));
}

export async function ownerDraftCount(db: Db, ownerId: string): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(drafts)
    .where(eq(drafts.ownerId, ownerId));
  return rows[0]?.n ?? 0;
}
