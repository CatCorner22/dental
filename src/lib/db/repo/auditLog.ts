import { and, desc, eq, like, not, or } from "drizzle-orm";
import type { Db } from "../client";
import { auditLog, type AuditLogRow } from "../schema";

// Every column here is `text`, which in Postgres means "up to a gigabyte".
// That is fine for the fields we compose ourselves and wrong for the ones that
// can carry caller-supplied input — a login target, a filename, an error
// message echoed from a third-party API. One route logging an unbounded value
// turns the audit log into a place an attacker can store data, and the log is
// read on a page and exported to CSV, so the cost lands twice.
//
// So the bound lives HERE, at the single write, rather than being re-derived
// at each of the ~30 call sites where forgetting it is silent. These limits sit
// far above any legitimate value: the longest real target is a username (32),
// the longest real detail a merge summary (~200).
const MAX_ACTION = 64;
const MAX_NAME = 200;
const MAX_TARGET = 200;
const MAX_DETAIL = 1000;

// Truncation is marked, never silent: a value that was cut must not read as a
// complete fact later, in a record whose whole purpose is being trusted.
function cap(v: string | null | undefined, max: number): string | null {
  if (v == null) return null;
  return v.length <= max ? v : `${v.slice(0, max)}…[truncated]`;
}

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
    actorId: cap(entry.actorId, MAX_TARGET),
    actorName: cap(entry.actorName, MAX_NAME),
    action: cap(entry.action, MAX_ACTION) ?? "unknown",
    target: cap(entry.target, MAX_TARGET),
    detail: cap(entry.detail, MAX_DETAIL)
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

// The assist rows for one draft, oldest first — folded into the frozen
// filing as AI provenance. Details only ("normalize v1.0.0 [sources]");
// never note text, which no audit row carries anyway.
export async function assistEventsForDraft(db: Db, draftId: string): Promise<string[]> {
  const rows = await db
    .select({ detail: auditLog.detail })
    .from(auditLog)
    .where(and(eq(auditLog.action, "assist.used"), eq(auditLog.target, draftId)))
    .orderBy(auditLog.at, auditLog.id);
  return rows.map((r) => r.detail ?? "").filter(Boolean);
}

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
