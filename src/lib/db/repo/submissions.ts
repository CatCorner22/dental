import { desc, eq } from "drizzle-orm";
import type { Db } from "../client";
import { submissions, type SubmissionRow } from "../schema";

// Reserve a ticket row first (empty frozen text), so the serial id is known
// before the stamp is composed; the caller fills the frozen fields after.
export async function insertSubmissionShell(
  db: Db,
  row: {
    draftId: string;
    submittedById: string;
    submittedByName: string;
    submittedAtEt: string;
    filename: string;
    format: string;
    ruleVersion: string;
    auditStatus: string;
  }
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

export async function statRowsForUser(
  db: Db,
  userId: string
): Promise<{ auditStatus: string; submittedAtUtc: Date }[]> {
  return db
    .select({ auditStatus: submissions.auditStatus, submittedAtUtc: submissions.submittedAtUtc })
    .from(submissions)
    .where(eq(submissions.submittedById, userId));
}
