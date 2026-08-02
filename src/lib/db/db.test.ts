import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { createTestDb } from "./testDb";
import type { Db } from "./client";
import {
  countOtherActiveAdmins,
  countUsers,
  deleteUser,
  getUserByUsername,
  insertUser,
  listUsers,
  updateUser
} from "./repo/users";
import {
  deleteDraft,
  draftSubmissionCount,
  insertDraft,
  listDraftsByOwner,
  ownerDraftCount,
  transferDraft,
  updateDraftChecked
} from "./repo/drafts";
import { finalizeSubmission, insertSubmissionShell, statRowsForUser } from "./repo/submissions";
import { listAuditLog, logAction } from "./repo/auditLog";
import { formatTicket } from "@/lib/tickets/ticket";
import type { NoteState } from "@/lib/schema/types";

let db: Db;
let close: () => Promise<void>;
const note: NoteState = { selectedModuleIds: ["extraction"], values: {} };

async function freshUser(username: string, role: "readonly" | "user" | "admin" = "user") {
  return insertUser(db, {
    id: crypto.randomUUID(),
    username,
    displayName: username,
    role,
    passHash: "x",
    active: true
  });
}

describe("db layer (PGlite)", () => {
  beforeAll(async () => {
    const t = await createTestDb();
    db = t.db;
    close = t.close;
  });
  beforeEach(async () => {
    // One WASM instance per file; wipe tables between tests (FK-safe order).
    await db.execute(sql`TRUNCATE submissions, drafts, audit_log, users RESTART IDENTITY CASCADE`);
  });
  afterAll(async () => {
    if (close) await close();
  });

  it("creates and reads users; enforces unique usernames", async () => {
    expect(await countUsers(db)).toBe(0);
    await freshUser("alice", "admin");
    expect(await countUsers(db)).toBe(1);
    expect((await getUserByUsername(db, "alice"))?.role).toBe("admin");
    await expect(freshUser("alice")).rejects.toBeTruthy();
  });

  it("updates a user and lists them", async () => {
    const u = await freshUser("bob");
    await updateUser(db, u.id, { role: "admin", active: false });
    const rows = await listUsers(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe("admin");
    expect(rows[0].active).toBe(false);
  });

  it("guards the last active admin", async () => {
    const a1 = await freshUser("admin1", "admin");
    expect(await countOtherActiveAdmins(db, a1.id)).toBe(0);
    const a2 = await freshUser("admin2", "admin");
    expect(await countOtherActiveAdmins(db, a1.id)).toBe(1);
    await updateUser(db, a2.id, { active: false });
    expect(await countOtherActiveAdmins(db, a1.id)).toBe(0);
  });

  it("optimistic draft update bumps version and rejects a stale write", async () => {
    const owner = await freshUser("carol");
    const draft = await insertDraft(db, { id: crypto.randomUUID(), ownerId: owner.id, noteState: note });
    expect(draft.version).toBe(1);
    const ok = await updateDraftChecked(db, draft.id, 1, { title: "Updated" }, new Date(2026, 0, 1));
    expect(ok?.version).toBe(2);
    // Re-using the old baseVersion must not apply.
    const stale = await updateDraftChecked(db, draft.id, 1, { title: "Nope" }, new Date(2026, 0, 1));
    expect(stale).toBeUndefined();
  });

  it("lists drafts by owner and transfers ownership", async () => {
    const from = await freshUser("dan");
    const to = await freshUser("erin");
    const d = await insertDraft(db, { id: crypto.randomUUID(), ownerId: from.id, noteState: note });
    expect(await ownerDraftCount(db, from.id)).toBe(1);
    await transferDraft(db, d.id, to.id, new Date());
    expect(await ownerDraftCount(db, from.id)).toBe(0);
    expect((await listDraftsByOwner(db, to.id))).toHaveLength(1);
  });

  it("mints sequential ticket numbers and freezes submission text", async () => {
    const u = await freshUser("fay");
    const d = await insertDraft(db, { id: crypto.randomUUID(), ownerId: u.id, noteState: note });
    const s1 = await insertSubmissionShell(db, {
      draftId: d.id,
      submittedById: u.id,
      submittedByName: "Fay (fay)",
      submittedAtEt: "2026-08-02 10:00 EDT",
      filename: "note-a",
      format: "md",
      ruleVersion: "2.0.0",
      auditStatus: "AUDIT PASS — CLINICIAN REVIEW STILL REQUIRED"
    });
    expect(formatTicket(s1.id)).toBe("DN-000001");
    await finalizeSubmission(db, s1.id, "# frozen note", "# frozen audit");
    const s2 = await insertSubmissionShell(db, {
      draftId: d.id,
      submittedById: u.id,
      submittedByName: "Fay (fay)",
      submittedAtEt: "2026-08-02 10:05 EDT",
      filename: "note-b",
      format: "md",
      ruleVersion: "2.0.0",
      auditStatus: "READY FOR CLINICIAN REVIEW"
    });
    expect(formatTicket(s2.id)).toBe("DN-000002");
    expect(await draftSubmissionCount(db, d.id)).toBe(2);
    const stats = await statRowsForUser(db, u.id);
    expect(stats).toHaveLength(2);
  });

  it("delete-user is safe to gate on their draft count", async () => {
    const u = await freshUser("gwen");
    const d = await insertDraft(db, { id: crypto.randomUUID(), ownerId: u.id, noteState: note });
    expect(await ownerDraftCount(db, u.id)).toBe(1);
    await deleteDraft(db, d.id);
    expect(await ownerDraftCount(db, u.id)).toBe(0);
    await deleteUser(db, u.id);
    expect(await countUsers(db)).toBe(0);
  });

  it("writes and reads the audit log newest-first", async () => {
    const admin = await freshUser("hank", "admin");
    await logAction(db, { actorId: admin.id, action: "user.create", target: "newbie" });
    await logAction(db, { actorId: admin.id, action: "draft.transfer", detail: "a->b" });
    const log = await listAuditLog(db);
    expect(log).toHaveLength(2);
    expect(log[0].action).toBe("draft.transfer");
  });
});
