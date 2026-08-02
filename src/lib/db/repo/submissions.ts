import { and, desc, eq, ne, sql } from "drizzle-orm";
import type { Db } from "../client";
import { drafts, submissions, type SubmissionRow } from "../schema";
import { formatTicket } from "@/lib/tickets/ticket";

export interface SubmissionShellFields {
  draftId: string;
  submittedById: string;
  submittedByName: string;
  submittedAtEt: string;
  filename: string;
  format: string;
  ruleVersion: string;
  auditStatus: string;
}

export type FileSubmissionResult =
  | { filed: false } // already submitted, or the draft changed since the caller read it
  | { filed: true; submissionId: number; ticket: string; version: number };

// Reserve a ticket row first (empty frozen text), so the serial id is known
// before the stamp is composed. Retained for tests and non-atomic callers;
// the submit route uses fileSubmissionAtomic below.
export async function insertSubmissionShell(
  db: Db,
  row: SubmissionShellFields
): Promise<SubmissionRow> {
  const [created] = await db
    .insert(submissions)
    .values({ ...row, noteMarkdown: "", auditReport: "" })
    .returning();
  return created;
}

export async function finalizeSubmission(
  db: Db,
  id: number,
  noteMarkdown: string,
  auditReport: string
): Promise<void> {
  await db.update(submissions).set({ noteMarkdown, auditReport }).where(eq(submissions.id, id));
}

// File a submission ATOMICALLY: claim the draft, reserve the ticket row, and
// write the frozen note + audit report — all in ONE transaction. Either a
// complete, consistent ticket exists and the draft reads "submitted", or
// nothing changed and the draft stays fully resubmittable. This closes two
// hazards a claim-then-write sequence has: a partial failure that strands the
// draft as falsely "submitted" with no ticket, and a phantom ticket left with
// blank frozen text in the permanent record. The email is sent by the caller
// AFTER this commits (a send failure is recoverable; a torn write is not).
//
// The claim is pinned to expectedVersion — the version whose noteState the
// caller composed and audited. An autosave that lands between the caller's
// read and this claim makes the claim miss, so a stale copy of the note can
// never be frozen as the legal record. The claim also BUMPS the version, so
// a queued autosave from before the submit gets a clean 409 instead of
// silently flipping the just-submitted draft back to "ready" (which would
// re-enable Submit and file a duplicate ticket for identical content).
export async function fileSubmissionAtomic(
  db: Db,
  shell: SubmissionShellFields,
  expectedVersion: number,
  now: Date,
  buildFrozen: (ticket: string) => { note: string; audit: string }
): Promise<FileSubmissionResult> {
  return db.transaction(async (tx) => {
    const claimed = await tx
      .update(drafts)
      .set({
        status: "submitted",
        lastSendFailed: false,
        version: expectedVersion + 1,
        updatedAt: now
      })
      .where(
        and(
          eq(drafts.id, shell.draftId),
          ne(drafts.status, "submitted"),
          eq(drafts.version, expectedVersion)
        )
      )
      .returning();
    if (claimed.length === 0) return { filed: false };

    const [row] = await tx
      .insert(submissions)
      .values({ ...shell, noteMarkdown: "", auditReport: "" })
      .returning();
    const ticket = formatTicket(row.id);
    const frozen = buildFrozen(ticket);
    await tx
      .update(submissions)
      .set({ noteMarkdown: frozen.note, auditReport: frozen.audit })
      .where(eq(submissions.id, row.id));
    return { filed: true, submissionId: row.id, ticket, version: claimed[0].version };
  });
}

export async function getSubmission(db: Db, id: number): Promise<SubmissionRow | undefined> {
  const [row] = await db.select().from(submissions).where(eq(submissions.id, id)).limit(1);
  return row;
}

export async function listAllSubmissions(db: Db): Promise<SubmissionRow[]> {
  return db.select().from(submissions).orderBy(desc(submissions.submittedAtUtc));
}

export async function listSubmissionsByUser(db: Db, userId: string): Promise<SubmissionRow[]> {
  return db
    .select()
    .from(submissions)
    .where(eq(submissions.submittedById, userId))
    .orderBy(desc(submissions.submittedAtUtc));
}

// A user with submission history is part of the legal record and must not
// be deletable — the DELETE route checks this before touching the FK.
export async function submissionCountByUser(db: Db, userId: string): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(submissions)
    .where(eq(submissions.submittedById, userId));
  return rows[0]?.n ?? 0;
}

export async function statRowsForUser(
  db: Db,
  userId: string
): Promise<{ auditStatus: string; submittedAtUtc: Date }[]> {
  return db
    .select({ auditStatus: submissions.auditStatus, submittedAtUtc: submissions.submittedAtUtc })
    .from(submissions)
    .where(eq(submissions.submittedById, userId));
}
