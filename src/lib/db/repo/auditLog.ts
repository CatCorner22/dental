import { desc } from "drizzle-orm";
import type { Db } from "../client";
import { auditLog, type AuditLogRow } from "../schema";

export async function logAction(
  db: Db,
  entry: {
    actorId: string | null;
    // Frozen "Display (username)" — survives the actor's later deletion, so
    // the log never degrades to "unknown". Omit only for system actions.
    actorName?: string | null;
    action: string;
    target?: string | null;
    detail?: string | null;
  }
): Promise<void> {
  await db.insert(auditLog).values({
    actorId: entry.actorId,
    actorName: entry.actorName ?? null,
    action: entry.action,
    target: entry.target ?? null,
    detail: entry.detail ?? null
  });
}

// Ordered by id as well as time, not time alone. Several entries routinely
// share a timestamp — a submit writes its action and its PHI-override
// attestation in the same instant — and ordering by `at` alone leaves those
// ties to the query plan, so the same log could render in a different order
// on two loads. The serial id is the tiebreaker that makes "what happened
// next" a fact rather than a coincidence.
export async function listAuditLog(db: Db, limit = 200): Promise<AuditLogRow[]> {
  return db
    .select()
    .from(auditLog)
    .orderBy(desc(auditLog.at), desc(auditLog.id))
    .limit(limit);
}
