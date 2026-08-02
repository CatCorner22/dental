import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { createTestDb } from "./testDb";
import { applySchema } from "./client";
import type { Db } from "./client";
import {
  ackNotice,
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
  fileSubmissionAtomic,
  finalizeSubmission,
  getSubmission,
  insertSubmissionShell,
  statRowsForUser,
  submissionCountByUser
} from "./repo/submissions";
import { listAuditLog, logAction } from "./repo/auditLog";
import {
  FREE_ATTEMPTS,
  MAX_LOCK_MS,
  WINDOW_MS,
  checkThrottle,
  clearThrottle,
  recordFailure
} from "@/lib/auth/throttle";
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
    await db.execute(
      sql`TRUNCATE submissions, drafts, audit_log, users, auth_throttle RESTART IDENTITY CASCADE`
    );
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

  // A transfer must invalidate the previous owner's open editor: their next
  // save carries the pre-transfer baseVersion and has to lose cleanly rather
  // than write into a draft that is no longer theirs.
  it("bumps the version on transfer so a stale write from the old owner fails", async () => {
    const from = await freshUser("nora");
    const to = await freshUser("omar");
    const d = await insertDraft(db, { id: crypto.randomUUID(), ownerId: from.id, noteState: note });
    const before = (await getDraft(db, d.id))!.version;
    await transferDraft(db, d.id, to.id, new Date());
    const after = (await getDraft(db, d.id))!.version;
    expect(after).toBe(before + 1);
    const stale = await updateDraftChecked(db, d.id, before, { title: "old owner" }, new Date());
    expect(stale).toBeUndefined();
  });

  // Acknowledging is idempotent; only the call that actually records it
  // reports true, so a repeat POST cannot append another audit-log row.
  it("reports the notice acknowledgement only once", async () => {
    const u = await freshUser("pia");
    expect(await ackNotice(db, u.id, new Date())).toBe(true);
    expect(await ackNotice(db, u.id, new Date())).toBe(false);
  });

  // The throttle is what stands between an unmetered cost-12 bcrypt endpoint
  // and anyone with a script, so its state transitions are worth pinning.
  describe("auth throttle", () => {
    const now = new Date(2026, 5, 1, 12, 0, 0);

    it("stays unlocked through the free attempts, then locks", async () => {
      const key = "login:mallory";
      for (let i = 0; i < FREE_ATTEMPTS; i++) {
        expect((await recordFailure(db, key, now)).locked, `failure ${i + 1}`).toBe(false);
      }
      const locked = await recordFailure(db, key, now);
      expect(locked.locked).toBe(true);
      expect(locked.retryAfterSec).toBeGreaterThan(0);
      expect((await checkThrottle(db, key, now)).locked).toBe(true);
    });

    it("expires the lock once its time has passed", async () => {
      const key = "login:transient";
      for (let i = 0; i <= FREE_ATTEMPTS; i++) await recordFailure(db, key, now);
      expect((await checkThrottle(db, key, now)).locked).toBe(true);
      const later = new Date(now.getTime() + MAX_LOCK_MS + 1000);
      expect((await checkThrottle(db, key, later)).locked).toBe(false);
    });

    // An attacker must not be able to keep a real user locked out forever by
    // guessing; the correct password always ends the streak.
    it("clears on success", async () => {
      const key = "login:victim";
      for (let i = 0; i <= FREE_ATTEMPTS; i++) await recordFailure(db, key, now);
      expect((await checkThrottle(db, key, now)).locked).toBe(true);
      await clearThrottle(db, key);
      expect((await checkThrottle(db, key, now)).locked).toBe(false);
    });

    it("forgives a stale streak instead of compounding it forever", async () => {
      const key = "login:forgetful";
      for (let i = 0; i < FREE_ATTEMPTS; i++) await recordFailure(db, key, now);
      // One failure long after the window: the count restarts rather than
      // tipping straight into a lock.
      const muchLater = new Date(now.getTime() + WINDOW_MS + 60_000);
      expect((await recordFailure(db, key, muchLater)).locked).toBe(false);
    });
  });

  // The re-file guard: a filed draft must not be fileable again, but an
  // edited one must be. This is what keeps an email outage from appending a
  // duplicate ticket per retry.
  it("marks a filed draft with its submission and blocks a second filing", async () => {
    const u = await freshUser("quinn");
    const d = await insertDraft(db, { id: crypto.randomUUID(), ownerId: u.id, noteState: note });
    const filed = await fileSubmissionAtomic(
      db,
      {
        draftId: d.id,
        submittedById: u.id,
        submittedByName: "Quinn (quinn)",
        submittedAtEt: "2026-06-01 10:00 ET",
        filename: "note",
        format: "md",
        ruleVersion: "2.0.0",
        auditStatus: "PASS"
      },
      d.version,
      new Date(),
      () => ({ note: "frozen", audit: "frozen-audit" })
    );
    expect(filed.filed).toBe(true);
    const after = (await getDraft(db, d.id))!;
    expect(after.lastSubmissionId).toBe(filed.filed ? filed.submissionId : null);

    // An edit clears the marker, which is what makes it submittable again.
    await updateDraftChecked(db, d.id, after.version, { lastSubmissionId: null }, new Date());
    expect((await getDraft(db, d.id))!.lastSubmissionId).toBeNull();
  });

  // Drafts filed BEFORE last_submission_id existed have NULL in it. Since the
  // submit guard now keys on that column, an unbackfilled legacy draft would
  // read as never-filed and could be filed a second time — a duplicate ticket
  // for identical content, in a record that is supposed to be immutable.
  it("backfills last_submission_id for drafts filed before the column existed", async () => {
    const u = await freshUser("rhea");
    const shell = (draftId: string) => ({
      draftId,
      submittedById: u.id,
      submittedByName: "Rhea (rhea)",
      submittedAtEt: "2026-06-01 10:00 ET",
      filename: "note",
      format: "md",
      ruleVersion: "2.0.0",
      auditStatus: "PASS"
    });

    // A draft that is filed and still submitted, and one that was filed and
    // then edited (so it must STAY submittable).
    const filedDraft = await insertDraft(db, { id: crypto.randomUUID(), ownerId: u.id, noteState: note });
    await fileSubmissionAtomic(db, shell(filedDraft.id), filedDraft.version, new Date(), () => ({
      note: "frozen",
      audit: "audit"
    }));
    const editedDraft = await insertDraft(db, { id: crypto.randomUUID(), ownerId: u.id, noteState: note });
    await fileSubmissionAtomic(db, shell(editedDraft.id), editedDraft.version, new Date(), () => ({
      note: "frozen",
      audit: "audit"
    }));
    // Re-create the pre-migration state: column NULL on both.
    await db.execute(sql`UPDATE drafts SET last_submission_id = NULL`);
    // The edited one also has a recomputed status, which is what tells the
    // backfill to leave it alone.
    await db.execute(sql`UPDATE drafts SET status = 'ready' WHERE id = ${editedDraft.id}`);

    await applySchema(db); // idempotent DDL, including the backfill

    expect((await getDraft(db, filedDraft.id))!.lastSubmissionId).not.toBeNull();
    // Edited-after-filing must remain submittable, so it stays NULL.
    expect((await getDraft(db, editedDraft.id))!.lastSubmissionId).toBeNull();
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

  it("files a submission atomically: one winner, no phantom, resubmit after edit", async () => {
    const u = await freshUser("olivia");
    const d = await insertDraft(db, { id: crypto.randomUUID(), ownerId: u.id, noteState: note });
    const now = new Date(2026, 7, 2);
    const shell = {
      draftId: d.id,
      submittedById: u.id,
      submittedByName: "Olivia (olivia)",
      submittedAtEt: "2026-08-02 10:00 EDT",
      filename: "note",
      format: "md",
      ruleVersion: "2.0.0",
      auditStatus: "AUDIT PASS — CLINICIAN REVIEW STILL REQUIRED"
    };
    const build = (ticket: string) => ({ note: `# note ${ticket}`, audit: `# audit ${ticket}` });

    const first = await fileSubmissionAtomic(db, shell, 1, now, build);
    expect(first.filed).toBe(true);
    // The frozen text is never blank — the shell insert and finalize commit together.
    if (first.filed) {
      const row = await getSubmission(db, first.submissionId);
      expect(row?.noteMarkdown).toContain(first.ticket);
      expect(row?.auditReport).toContain(first.ticket);
      // The claim bumps the version, so a queued pre-submit autosave 409s
      // instead of silently reopening the just-submitted draft.
      expect(first.version).toBe(2);
    }
    // A concurrent/duplicate submit of the same unedited draft is refused with
    // no second ticket.
    const second = await fileSubmissionAtomic(db, shell, 2, now, build);
    expect(second.filed).toBe(false);
    expect(await draftSubmissionCount(db, d.id)).toBe(1);

    // A queued autosave from before the submit is a stale write now.
    expect(await updateDraftChecked(db, d.id, 1, { status: "ready" }, now)).toBeUndefined();

    // An edit at the CURRENT version reopens the draft…
    await updateDraftChecked(db, d.id, 2, { status: "ready" }, now);
    // …but a submit still pinned to a superseded version is refused: the
    // note changed after that submit's copy was composed and audited.
    const stale = await fileSubmissionAtomic(db, shell, 2, now, build);
    expect(stale.filed).toBe(false);
    expect(await draftSubmissionCount(db, d.id)).toBe(1);

    // A rolled-back attempt (the frozen builder throws) leaves no phantom row
    // and the claim (status AND version bump) rolls back with it.
    await expect(
      fileSubmissionAtomic(db, shell, 3, now, () => {
        throw new Error("compose failed");
      })
    ).rejects.toBeTruthy();
    expect(await draftSubmissionCount(db, d.id)).toBe(1); // no blank ticket added
    const after = await getDraft(db, d.id);
    expect(after?.status).toBe("ready"); // claim rolled back
    expect(after?.version).toBe(3); // version bump rolled back too
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
