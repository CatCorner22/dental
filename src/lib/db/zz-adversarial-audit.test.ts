import { afterAll, beforeAll, expect, it, describe } from "vitest";
import { sql, like, not, or } from "drizzle-orm";
import { createTestDb } from "./testDb";
import type { Db } from "./client";
import { listAuditLog, logAction } from "./repo/auditLog";
import { auditLog } from "./schema";

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});
afterAll(async () => {
  await close();
});

describe("listAuditLog filter=security", () => {
  it("shows what SQL drizzle actually emits for not(or(like(...)))", async () => {
    const q = db
      .select()
      .from(auditLog)
      .where(not(or(like(auditLog.action, "auth.signin"))!));
    // @ts-expect-error toSQL exists on the query builder
    console.log("SECURITY SQL:", JSON.stringify(q.toSQL(), null, 2));
    const q2 = db.select().from(auditLog).where(like(auditLog.action, "auth.%"));
    // @ts-expect-error toSQL exists on the query builder
    console.log("AUTH SQL:", JSON.stringify(q2.toSQL(), null, 2));
  });

  it("actually filters rows the way the comment claims", async () => {
    const rows = [
      { action: "auth.signin", target: "alice" },
      { action: "auth.signin", target: "bob" },
      { action: "auth.failed", target: "carol" },
      { action: "auth.lockout", target: "dave" },
      { action: "auth.revoke-sessions", target: "erin" },
      { action: "user.create", target: "frank" },
      { action: "user.delete", target: "grace" },
      { action: "submit", target: "SN-1" },
      { action: "draft.delete", target: "d1" },
      { action: "export.csv", target: "users" },
      { action: "notice.ack", target: "alice" }
    ];
    for (const r of rows) {
      await logAction(db, { actorId: "u1", actorName: "A (a)", action: r.action, target: r.target });
    }
    // A row with a NULL-ish action is impossible (notNull), but detail/target null is fine.

    const all = await listAuditLog(db, 500, "all");
    const auth = await listAuditLog(db, 500, "auth");
    const security = await listAuditLog(db, 500, "security");

    console.log("all       :", all.length, all.map((r) => r.action).join(","));
    console.log("auth      :", auth.length, auth.map((r) => r.action).join(","));
    console.log("security  :", security.length, security.map((r) => r.action).join(","));

    expect(all.length).toBe(rows.length);
    // Documented intent: "the SHARP subset: failed sign-ins, lockouts, and every
    // user-management action, with routine successful sign-ins removed."
    const securityActions = new Set(security.map((r) => r.action));
    expect(securityActions.has("auth.signin")).toBe(false);
    // Does it match everything else? (i.e. is it really "not signin" == all-but-signin)
    expect(security.length).toBe(rows.length - 2);
  });

  it("LIKE 'auth.signin' has no wildcard — check a lookalike action is excluded/included", async () => {
    const { db: db2, close: c2 } = await createTestDb();
    await logAction(db2, { actorId: null, action: "auth.signin", target: "x" });
    await logAction(db2, { actorId: null, action: "auth.signin.mfa", target: "x" });
    await logAction(db2, { actorId: null, action: "auth_signin", target: "x" }); // _ is a LIKE wildcard!
    const sec = await listAuditLog(db2, 500, "security");
    console.log("lookalike security:", sec.map((r) => r.action).join(","));
    await c2();
  });

  it("underscore-wildcard check on filter=auth", async () => {
    const { db: db2, close: c2 } = await createTestDb();
    await logAction(db2, { actorId: null, action: "authXsomething", target: "x" });
    await logAction(db2, { actorId: null, action: "auth.signin", target: "x" });
    const a = await listAuditLog(db2, 500, "auth");
    console.log("auth filter matched:", a.map((r) => r.action).join(","));
    await c2();
  });

  it("raw SQL sanity: what does `not X like Y` bind to in postgres", async () => {
    const r1 = await db.execute(sql`SELECT (not 'auth.signin' like 'auth.signin') AS a,
      (not 'user.create' like 'auth.signin') AS b`);
    console.log("raw:", JSON.stringify(r1.rows ?? r1));
  });
});
