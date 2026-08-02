import { and, desc, eq, isNotNull, ne, sql } from "drizzle-orm";
import type { Db } from "../client";
import { drafts, submissions, type DraftRow, type NewDraft } from "../schema";
import { DEFAULT_PAGE_SIZE, type PageParams } from "@/lib/http/pagination";

const DEFAULT_PAGE: PageParams = { limit: DEFAULT_PAGE_SIZE, offset: 0 };

export async function insertDraft(db: Db, draft: NewDraft): Promise<DraftRow> {
  const [row] = await db.insert(drafts).values(draft).returning();
  return row;
}

export async function getDraft(db: Db, id: string): Promise<DraftRow | undefined> {
  const [row] = await db.select().from(drafts).where(eq(drafts.id, id)).limit(1);
  return row;
}

// List views show a row of scalars, never the note itself. Selecting the
// whole row would drag every draft's noteState — up to ~120KB of jsonb each —
// out of the database and through memory just to render a title and a date.
// The dashboard needs the selected module ids to show what a draft covers,
// so those are pulled out of the jsonb in SQL rather than shipping the whole
// note back to render a row of chips.
export type DraftSummary = Pick<
  DraftRow,
  "id" | "title" | "status" | "ownerId" | "version" | "updatedAt" | "lastSendFailed"
> & { moduleIds: string[] };

const draftSummaryColumns = {
  id: drafts.id,
  title: drafts.title,
  status: drafts.status,
  ownerId: drafts.ownerId,
  version: drafts.version,
  updatedAt: drafts.updatedAt,
  lastSendFailed: drafts.lastSendFailed,
  moduleIds: sql<string[]>`coalesce(${drafts.noteState} -> 'selectedModuleIds', '[]'::jsonb)`
};

// Newest activity first — the note you just touched belongs on top.
// Always bounded: callers pass a page, and the default page is a page, not
// the whole table.
export async function listAllDrafts(db: Db, page: PageParams = DEFAULT_PAGE): Promise<DraftSummary[]> {
  return db
    .select(draftSummaryColumns)
    .from(drafts)
    .orderBy(desc(drafts.updatedAt))
    .limit(page.limit)
    .offset(page.offset);
}

export async function listDraftsByOwner(
  db: Db,
  ownerId: string,
  page: PageParams = DEFAULT_PAGE
): Promise<DraftSummary[]> {
  return db
    .select(draftSummaryColumns)
    .from(drafts)
    .where(eq(drafts.ownerId, ownerId))
    .orderBy(desc(drafts.updatedAt))
    .limit(page.limit)
    .offset(page.offset);
}

export async function countAllDrafts(db: Db): Promise<number> {
  const rows = await db.select({ n: sql<number>`count(*)::int` }).from(drafts);
  return rows[0]?.n ?? 0;
}

// Optimistic-concurrency update: only applies when the caller's baseVersion
// matches the stored version, then bumps it. Returns undefined on a stale write.
export async function updateDraftChecked(
  db: Db,
  id: string,
  baseVersion: number,
  patch: Partial<
    Pick<DraftRow, "title" | "noteState" | "status" | "lastSendFailed" | "lastSubmissionId">
  >,
  now: Date
): Promise<DraftRow | undefined> {
  const [row] = await db
    .update(drafts)
    .set({ ...patch, version: baseVersion + 1, updatedAt: now })
    .where(and(eq(drafts.id, id), eq(drafts.version, baseVersion)))
    .returning();
  return row;
}

// Atomically claim a draft for submission. Exactly one of any set of
// concurrent submit requests flips the status to "submitted"; the rest see
// zero rows and give up. This closes the double-click / two-tab race that a
// read-then-check cannot: two tickets and two corporate emails for one note.
// If the process dies between this claim and inserting the submission row,
// the draft merely reads "submitted" until the next edit recomputes it —
// no phantom ticket exists.
export async function claimDraftForSubmit(db: Db, id: string, now: Date): Promise<boolean> {
  const rows = await db
    .update(drafts)
    .set({ status: "submitted", lastSendFailed: false, updatedAt: now })
    .where(and(eq(drafts.id, id), ne(drafts.status, "submitted")))
    .returning();
  return rows.length > 0;
}

// Post-email status write (submit and resend call it after the send round-trip).
// Bumps updatedAt (a submission is activity) but NOT version, so an open builder
// tab's next save does not hit a false conflict.
//
// expectVersion GUARDS against clobbering a concurrent edit: the email round-
// trip takes seconds, and in that window a second tab can PATCH the note (which
// bumps version, nulls lastSubmissionId, and recomputes status away from
// submitted). Without the guard, a late "error"/"submitted" write would stamp a
// stale status onto that edited row — falsely marking an edited draft "Send
// failed", or worse leaving it both un-submittable and un-resendable. When
// expectVersion is given, the write only lands on the still-filed row it was
// computed for; a concurrent edit wins. Returns whether it applied.
export async function setDraftStatus(
  db: Db,
  id: string,
  status: string,
  lastSendFailed: boolean,
  now: Date,
  expectVersion?: number
): Promise<boolean> {
  const where =
    expectVersion === undefined
      ? eq(drafts.id, id)
      : and(
          eq(drafts.id, id),
          eq(drafts.version, expectVersion),
          isNotNull(drafts.lastSubmissionId)
        );
  const rows = await db
    .update(drafts)
    .set({ status, lastSendFailed, updatedAt: now })
    .where(where)
    .returning();
  return rows.length > 0;
}

// Atomically claim a filed-but-undelivered draft for a resend. Flips
// lastSendFailed off so two concurrent resends cannot both send the same frozen
// copy — exactly one claim matches; the other gets undefined and bows out. A
// concurrent edit (which also clears lastSendFailed and nulls lastSubmissionId)
// makes the claim miss, so a resend never fights an edit. Returns the version
// and submission id to send, or undefined if there was nothing to claim.
export async function claimResend(
  db: Db,
  id: string,
  now: Date
): Promise<{ version: number; lastSubmissionId: number } | undefined> {
  const [row] = await db
    .update(drafts)
    .set({ lastSendFailed: false, updatedAt: now })
    .where(and(eq(drafts.id, id), eq(drafts.lastSendFailed, true), isNotNull(drafts.lastSubmissionId)))
    .returning();
  if (!row || row.lastSubmissionId === null) return undefined;
  return { version: row.version, lastSubmissionId: row.lastSubmissionId };
}

export async function transferDraft(db: Db, id: string, toUserId: string, now: Date): Promise<void> {
  // Bump the version so an old owner's in-flight save loses its optimistic
  // check and gets a clean 409 instead of silently writing to a draft that no
  // longer belongs to them. The new owner loads after the transfer, so they
  // see the bumped version already.
  await db
    .update(drafts)
    .set({ ownerId: toUserId, version: sql`${drafts.version} + 1`, updatedAt: now })
    .where(eq(drafts.id, id));
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
