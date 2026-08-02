import { desc } from "drizzle-orm";
import type { Db } from "../client";
import { auditLog, type AuditLogRow } from "../schema";

export async function logAction(
  db: Db,
  entry: { actorId: string | null; action: string; target?: string | null; detail?: string | null }
): Promise<void> {
  await db.insert(auditLog).values({
    actorId: entry.actorId,
    action: entry.action,
    target: entry.target ?? null,
    detail: entry.detail ?? null
  });
}

export async function listAuditLog(db: Db, limit = 200): Promise<AuditLogRow[]> {
  return db.select().from(auditLog).orderBy(desc(auditLog.at)).limit(limit);
}
