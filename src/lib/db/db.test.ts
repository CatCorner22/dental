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
  mutateAdminGuarded,
  updateUser
} from "./repo/users";
import {
  claimDraftForSubmit,
  deleteDraft,
  draftSubmissionCount,
  getDraft,
  insertDraft,
  listDraftsByOwner,
  ownerDraftCount,
  transferDraft,
  updateDraftChecked
} from "./repo/drafts";
import {
  finalizeSubmission,
  insertSubmissionShell,
  statRowsForUser,
  submissionCountByUser
} from "./repo/submissions";
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

  it("lists drafts newest-updated first", async () => {
    const owner = await freshUser("iris");
    const older = await insertDraft(db, { id: crypto.randomUUID(), ownerId: owner.id, title: "older", noteState: note });
    const newer = await insertDraft(db, { id: crypto.randomUUID(), ownerId: owner.id, title: "newer", noteState: note });
    // Touch "newer" so its updatedAt is later.
    await updateDraftChecked(db, newer.id, 1, { title: "newer" }, new Date(2026, 5, 1));
    await updateDraftChecked(db, older.id, 1, { title: "older" }, new Date(2026, 0, 1));
    const list = await listDraftsByOwner(db, owner.id);
    expect(list.map((d) => d.title)).toEqual(["newer", "older"]);
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

  it("claims a draft for submission exactly once until it is edited", async () => {
    const u = await freshUser("jill");
    const d = await insertDraft(db, { id: crypto.randomUUID(), ownerId: u.id, noteState: note });
    const now = new Date(2026, 7, 2);
    // First claim wins; the immediate second (a double-click) loses.
    expect(await claimDraftForSubmit(db, d.id, now)).toBe(true);
    expect(await claimDraftForSubmit(db, d.id, now)).toBe(false);
    expect((await getDraft(db, d.id))?.status).toBe("submitted");
    // An edit recomputes the status (as the PATCH route does) and the draft
    // becomes claimable again.
    await updateDraftChecked(db, d.id, 1, { status: "ready" }, now);
    expect(await claimDraftForSubmit(db, d.id, now)).toBe(true);
  });

  it("admin-guarded mutation refuses to remove the last active admin", async () => {
    const a1 = await freshUser("kira", "admin");
    const a2 = await freshUser("liam", "admin");
    // Demoting one of two admins works…
    expect(await mutateAdminGuarded(db, a2.id, { kind: "update", patch: { role: "user" } })).toBe(true);
    // …but the survivor is untouchable, by demote, deactivate, or delete.
    expect(await mutateAdminGuarded(db, a1.id, { kind: "update", patch: { role: "user" } })).toBe(false);
    expect(await mutateAdminGuarded(db, a1.id, { kind: "update", patch: { active: false } })).toBe(false);
    expect(await mutateAdminGuarded(db, a1.id, { kind: "delete" })).toBe(false);
    expect((await getUserByUsername(db, "kira"))?.role).toBe("admin");
  });

  it("counts submissions per user so deletion can be blocked (FK safety)", async () => {
    const u = await freshUser("mona");
    const v = await freshUser("nate");
    const d = await insertDraft(db, { id: crypto.randomUUID(), ownerId: u.id, noteState: note });
    await insertSubmissionShell(db, {
      draftId: d.id,
      submittedById: u.id,
      submittedByName: "Mona (mona)",
      submittedAtEt: "2026-08-02 10:00 EDT",
      filename: "note",
      format: "md",
      ruleVersion: "2.0.0",
      auditStatus: "READY FOR CLINICIAN REVIEW"
    });
    // Transfer the draft away: mona owns nothing, yet her submission remains.
    await transferDraft(db, d.id, v.id, new Date());
    expect(await ownerDraftCount(db, u.id)).toBe(0);
    expect(await submissionCountByUser(db, u.id)).toBe(1);
    // Deleting her would violate the submissions FK — prove the DB agrees.
    await expect(deleteUser(db, u.id)).rejects.toBeTruthy();
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
