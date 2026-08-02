import { and, eq, ne, sql } from "drizzle-orm";
import type { Db } from "../client";
import { users, type NewUser, type UserRow } from "../schema";

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

export async function listUsers(db: Db): Promise<UserRow[]> {
  return db.select().from(users).orderBy(users.createdAt);
}

export async function updateUser(
  db: Db,
  id: string,
  patch: Partial<Pick<UserRow, "displayName" | "role" | "active" | "passHash" | "passwordChangedAt">>
): Promise<UserRow | undefined> {
  const [row] = await db.update(users).set(patch).where(eq(users.id, id)).returning();
  return row;
}

export async function ackNotice(db: Db, id: string, at: Date): Promise<void> {
  await db.update(users).set({ noticeAckAt: at }).where(eq(users.id, id));
}

export async function deleteUser(db: Db, id: string): Promise<void> {
  await db.delete(users).where(eq(users.id, id));
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
