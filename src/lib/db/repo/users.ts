import { and, eq, isNull, ne, or, sql } from "drizzle-orm";
import type { Db } from "../client";
import { drafts, submissions, users, type NewUser, type UserRow } from "../schema";
import { canMergeUsers, type Role } from "@/lib/auth/roles";

export async function countUsers(db: Db): Promise<number> {
  const rows = await db.select({ n: sql<number>`count(*)::int` }).from(users);
  return rows[0]?.n ?? 0;
}

export async function insertUser(db: Db, user: NewUser): Promise<UserRow> {
  const [row] = await db.insert(users).values(user).returning();
  return row;
}

export async function getUserByUsername(db: Db, username: string): Promise<UserRow | undefined> {
  const [row] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return row;
}

export async function getUserById(db: Db, id: string): Promise<UserRow | undefined> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row;
}

/**
 * Was `candidateId` minted by `ancestorId`, directly or through a chain of
 * accounts that person created?
 *
 * The one-level `createdById === actor.id` check that transfer and merge used
 * is defeated by a sock puppet at one remove. A manager may create Team Leads;
 * a Team Lead may create Team Members. So: mint lead B and lead C, have B mint
 * member P, and now C may transfer another clinician's live note into P —
 * because P was created by B, not by C — while one human holds the invite
 * mailbox for all three. That hands a single person write access to a
 * colleague's clinical record and the ability to file it under a name they
 * control, which is exactly what `canWriteNote` and frozen attribution exist
 * to prevent.
 *
 * The reset-link route already reasons transitively (`actorIsCreatureOfChanger`).
 * This is that idea, generalized and walked to the root.
 *
 * The walk is bounded and cycle-guarded: `createdById` is set once at creation
 * and cannot normally form a loop, but a legal record is not the place to
 * discover otherwise by hanging a request.
 */
export async function isCreatureOf(
  // Accepts a transaction handle as well as the pool: called from INSIDE
  // mergeUsers' transaction, and PGlite has one connection, so reaching for the
  // outer `db` there deadlocks until the test timeout. Caught by the db suite.
  db: Db | { select: Db["select"] },
  candidateId: string,
  ancestorId: string
): Promise<boolean> {
  const seen = new Set<string>();
  let cursor: string | null | undefined = candidateId;
  for (let hop = 0; hop < 16 && cursor; hop++) {
    if (seen.has(cursor)) return false;
    seen.add(cursor);
    const [row]: UserRow[] = await db
      .select()
      .from(users)
      .where(eq(users.id, cursor))
      .limit(1);
    const creator: string | null | undefined = row?.createdById;
    if (!creator) return false;
    if (creator === ancestorId) return true;
    cursor = creator;
  }
  return false;
}

export async function listUsers(db: Db): Promise<UserRow[]> {
  return db.select().from(users).orderBy(users.createdAt);
}

export async function updateUser(
  db: Db,
  id: string,
  patch: Partial<
    Pick<
      UserRow,
      | "displayName"
      | "role"
      | "active"
      | "passHash"
      | "passwordChangedAt"
      | "sessionsRevokedAt"
      | "email"
      | "groupEmail"
      | "emailChangedAt"
      | "emailChangedBy"
      | "mfaSecret"
      | "mfaEnabled"
    >
  >
): Promise<UserRow | undefined> {
  const [row] = await db.update(users).set(patch).where(eq(users.id, id)).returning();
  return row;
}

// Returns true only when this call is what actually recorded the
// acknowledgement. Acknowledging is idempotent, so a repeat POST must not
// append another audit-log row — the log is a record of things that happened,
// and re-clicking is not a new event.
export async function ackNotice(db: Db, id: string, at: Date): Promise<boolean> {
  const rows = await db
    .update(users)
    .set({ noticeAckAt: at })
    .where(and(eq(users.id, id), isNull(users.noticeAckAt)))
    .returning();
  return rows.length > 0;
}

export async function deleteUser(db: Db, id: string): Promise<void> {
  await db.delete(users).where(eq(users.id, id));
}

// Clear every account's second factor. Called from bootstrap ONLY while the
// deployment-level MFA switch is off, so that turning the switch back on later
// starts everyone clean instead of instantly re-locking whoever had enrolled
// before it was turned off. Returns the usernames actually cleared, so the
// caller logs a real event or nothing — an empty sweep is not news.
export async function clearAllMfa(db: Db): Promise<string[]> {
  const rows = await db
    .update(users)
    .set({ mfaEnabled: false, mfaSecret: null })
    .where(or(eq(users.mfaEnabled, true), sql`${users.mfaSecret} is not null`))
    .returning();
  return rows.map((r) => r.username);
}

// Guard against removing the last way in: count OTHER active admins.
export async function countOtherActiveAdmins(db: Db, excludeId: string): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.active, true), ne(users.id, excludeId)));
  return rows[0]?.n ?? 0;
}

// One lock key serializes every admin-losing mutation. Without it, two
// concurrent requests that each demote a DIFFERENT admin both pass the
// count check and together lock everyone out.
const ADMIN_GUARD_LOCK = 742001;

// Bootstrap the first admin atomically: two concurrent /api/setup requests
// with different usernames would otherwise both see an empty table and both
// become admin. Same lock family as the admin guard.
export async function createFirstAdminGuarded(db: Db, user: NewUser): Promise<"created" | "exists"> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${ADMIN_GUARD_LOCK})`);
    const rows = await tx.select({ n: sql<number>`count(*)::int` }).from(users);
    if ((rows[0]?.n ?? 0) > 0) return "exists";
    await tx.insert(users).values(user);
    return "created";
  });
}

export type MergeResult =
  | { ok: true; draftsMoved: number; submissionsKept: number }
  | { ok: false; reason: "same-user" | "missing" | "last-admin" | "bad-target" | "not-allowed" };

// Merge a duplicate account into the one the person actually uses.
//
// The governing rule: FROZEN SUBMISSION ATTRIBUTION IS NEVER REWRITTEN.
// `submissions.submittedByName` is a snapshot of who signed a filed Smile Note,
// and those notes are a legal and medical record. Retroactively re-attributing
// them to a different account would forge history — so submissions keep their
// original submittedById and submittedByName, and only the LIVE work (drafts)
// moves. The duplicate is deactivated rather than deleted for the same reason:
// its id is still referenced by the record it signed.
export async function mergeUsers(
  db: Db,
  sourceId: string,
  targetId: string,
  now: Date,
  // The caller's authority, re-asserted INSIDE the lock. The route checks the
  // ceilings first, but it reads both rows outside this transaction, so a role
  // change landing in between would widen what the merge may touch. Optional so
  // existing callers and tests keep working; when supplied it is authoritative.
  actor?: { id: string; role: Role }
): Promise<MergeResult> {
  if (sourceId === targetId) return { ok: false, reason: "same-user" };
  return db.transaction(async (tx) => {
    // Serialized on the same key as the other privilege-losing mutations, so a
    // merge cannot race a demotion into leaving no admin behind.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${ADMIN_GUARD_LOCK})`);
    const [source] = await tx.select().from(users).where(eq(users.id, sourceId)).limit(1);
    const [target] = await tx.select().from(users).where(eq(users.id, targetId)).limit(1);
    if (!source || !target) return { ok: false, reason: "missing" as const };

    if (actor && actor.role !== "admin") {
      // Transitive, not one level: see isCreatureOf. A one-level check let a
      // manager route a colleague's drafts into a puppet minted by a puppet.
      const targetIsPuppet = await isCreatureOf(tx, target.id, actor.id);
      const allowed =
        canMergeUsers(actor.role, source.role) &&
        canMergeUsers(actor.role, target.role) &&
        !targetIsPuppet &&
        target.createdById !== actor.id &&
        target.id !== actor.id &&
        source.id !== actor.id;
      if (!allowed) return { ok: false, reason: "not-allowed" as const };
    }
    // The target inherits live work, so it must be able to do that work: an
    // inactive or read-only target would strand every moved draft with an owner
    // who can never edit or file it, recoverable only by a Developer.
    if (!target.active || target.role === "readonly") {
      return { ok: false, reason: "bad-target" as const };
    }

    // Merging away an admin must not close the last door in.
    if (source.role === "admin" && source.active) {
      const [{ n }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(users)
        .where(and(eq(users.role, "admin"), eq(users.active, true), ne(users.id, sourceId)));
      if ((n ?? 0) === 0) return { ok: false, reason: "last-admin" as const };
    }

    const moved = await tx
      .update(drafts)
      // Bump the version like transferDraft does, so the source owner's
      // in-flight autosave loses its optimistic check and 409s instead of
      // silently writing into the merged draft.
      .set({ ownerId: targetId, version: sql`${drafts.version} + 1`, updatedAt: now })
      .where(eq(drafts.ownerId, sourceId))
      .returning();

    const [{ n: kept }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(submissions)
      .where(eq(submissions.submittedById, sourceId));

    // Deactivated, not deleted: filed submissions still point at this id, and
    // the account must not be able to sign in afterwards.
    await tx.update(users).set({ active: false }).where(eq(users.id, sourceId));

    return { ok: true as const, draftsMoved: moved.length, submissionsKept: kept ?? 0 };
  });
}

// Demote, deactivate, or delete an admin — atomically re-checking that
// another active admin remains. Returns false when the target is the last
// active admin (nothing is changed).
export async function mutateAdminGuarded(
  db: Db,
  id: string,
  action:
    | { kind: "update"; patch: Partial<Pick<UserRow, "displayName" | "role" | "active">> }
    | { kind: "delete" }
): Promise<boolean> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${ADMIN_GUARD_LOCK})`);
    const rows = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.role, "admin"), eq(users.active, true), ne(users.id, id)));
    if ((rows[0]?.n ?? 0) === 0) return false;
    if (action.kind === "update") {
      await tx.update(users).set(action.patch).where(eq(users.id, id));
    } else {
      await tx.delete(users).where(eq(users.id, id));
    }
    return true;
  });
}
