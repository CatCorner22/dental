import { desc, like, not, or } from "drizzle-orm";
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
// `filter` narrows to one family of events. Sign-ins are by far the highest
// volume once authentication is logged, and they would bury the rare rows a
// practice manager is actually hunting for — a failed sign-in, a role change —
// so the viewer can scope to what it needs:
//   "auth"     — everything authentication (signin/failed/lockout/revoke)
//   "security" — the SHARP subset: failed sign-ins, lockouts, and every user-
//                management action, with routine successful sign-ins removed.
//   "all"      — no filter (default).
export type AuditFilter = "all" | "auth" | "security";

export async function listAuditLog(
  db: Db,
  limit = 200,
  filter: AuditFilter = "all"
): Promise<AuditLogRow[]> {
  const q = db.select().from(auditLog);
  const scoped =
    filter === "auth"
      ? q.where(like(auditLog.action, "auth.%"))
      : filter === "security"
        ? // Everything EXCEPT a routine successful sign-in. A successful login
          // is the noise; a failed one is the signal, so it stays.
          q.where(not(or(like(auditLog.action, "auth.signin"))!))
        : q;
  return scoped.orderBy(desc(auditLog.at), desc(auditLog.id)).limit(limit);
}
