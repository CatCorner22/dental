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
  updateUser,
  mergeUsers
} from "./repo/users";
import {
  claimDraftForSubmit,
  deleteDraft,
  DRAFT_REVISION_KEEP,
  newestOpenDraftForOwner,
  setDraftStatus,
  draftSubmissionCount,
  getDraft,
  getDraftRevision,
  insertDraft,
  listDraftRevisions,
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
  submissionCountByUser,
  listAllSubmissions
} from "./repo/submissions";
import { listAuditLog, logAction } from "./repo/auditLog";
import {
  FREE_ATTEMPTS,
  IP_FREE_ATTEMPTS,
  IP_MAX_LOCK_MS,
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

async function freshUser(
  username: string,
  role: "readonly" | "user" | "lead" | "manager" | "admin" = "user"
) {
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
      sql`TRUNCATE password_reset_tokens, submissions, drafts, audit_log, users, auth_throttle RESTART IDENTITY CASCADE`
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

  // Power-loss / bad-paste recovery: every content autosave appends a working-copy
  // revision (capped ring). Status-only writes must not pollute that ring.
  it("records draft revisions on content saves and prunes the ring", async () => {
    const owner = await freshUser("revkeeper");
    const draft = await insertDraft(db, {
      id: crypto.randomUUID(),
      ownerId: owner.id,
      noteState: note,
      title: "v1"
    });
    expect(await listDraftRevisions(db, draft.id)).toHaveLength(0);

    let v = 1;
    const t0 = new Date(2026, 0, 1, 12, 0, 0);
    for (let i = 0; i < DRAFT_REVISION_KEEP + 3; i++) {
      const at = new Date(t0.getTime() + i * 60_000);
      const updated = await updateDraftChecked(
        db,
        draft.id,
        v,
        { title: `save-${i}`, noteState: { selectedModuleIds: ["extraction"], values: {} } },
        at
      );
      expect(updated?.version).toBe(v + 1);
      v = updated!.version;
    }
    const ring = await listDraftRevisions(db, draft.id);
    expect(ring).toHaveLength(DRAFT_REVISION_KEEP);
    expect(ring[0]!.title).toBe(`save-${DRAFT_REVISION_KEEP + 2}`);
    expect(ring[ring.length - 1]!.title).toBe("save-3");

    const statusOnly = await updateDraftChecked(
      db,
      draft.id,
      v,
      { status: "ready", lastSendFailed: false },
      new Date(2026, 0, 2)
    );
    expect(statusOnly?.version).toBe(v + 1);
    expect(await listDraftRevisions(db, draft.id)).toHaveLength(DRAFT_REVISION_KEEP);

    const oldestKept = ring[ring.length - 1]!;
    const loaded = await getDraftRevision(db, draft.id, oldestKept.id);
    expect(loaded?.title).toBe("save-3");
    expect(loaded?.noteState.selectedModuleIds).toEqual(["extraction"]);
  });

  // The home page IS the builder now, so which draft it opens is a product
  // decision expressed as a query. Getting it wrong is not a subtle bug: open
  // the wrong one and someone types into a filed record or into a teammate's
  // unfinished note.
  describe("the draft the home page opens", () => {
    it("returns nothing for a writer with no drafts", async () => {
      const owner = await freshUser("newcomer");
      expect(await newestOpenDraftForOwner(db, owner.id)).toBeUndefined();
    });

    it("resumes the most recently touched open draft", async () => {
      const owner = await freshUser("resumer");
      const older = await insertDraft(db, {
        id: crypto.randomUUID(),
        ownerId: owner.id,
        noteState: note,
        title: "older"
      });
      const newer = await insertDraft(db, {
        id: crypto.randomUUID(),
        ownerId: owner.id,
        noteState: note,
        title: "newer"
      });
      // insertDraft stamps its own updatedAt, so order them explicitly rather
      // than trusting two inserts in the same millisecond to sort.
      await updateDraftChecked(db, older.id, 1, { title: "older" }, new Date(2026, 0, 1));
      await updateDraftChecked(db, newer.id, 1, { title: "newer" }, new Date(2026, 0, 2));
      expect((await newestOpenDraftForOwner(db, owner.id))?.id).toBe(newer.id);
    });

    it("never reopens a filed note", async () => {
      // A submitted note is frozen. Landing a cursor in one is not resuming,
      // it is editing a record.
      const owner = await freshUser("filer");
      const d = await insertDraft(db, {
        id: crypto.randomUUID(),
        ownerId: owner.id,
        noteState: note
      });
      await setDraftStatus(db, d.id, "submitted", false, new Date(2026, 0, 3));
      expect(await newestOpenDraftForOwner(db, owner.id)).toBeUndefined();
    });

    it("still offers a send-failed draft, which needs a person", async () => {
      const owner = await freshUser("resender");
      const d = await insertDraft(db, {
        id: crypto.randomUUID(),
        ownerId: owner.id,
        noteState: note
      });
      await setDraftStatus(db, d.id, "send-failed", true, new Date(2026, 0, 3));
      expect((await newestOpenDraftForOwner(db, owner.id))?.id).toBe(d.id);
    });

    it("never opens someone else's draft, however new it is", async () => {
      // Ownership is not negotiable here even for an account that may READ
      // every note in the practice.
      const mine = await freshUser("mine");
      const theirs = await freshUser("theirs");
      const ours = await insertDraft(db, {
        id: crypto.randomUUID(),
        ownerId: mine.id,
        noteState: note
      });
      const other = await insertDraft(db, {
        id: crypto.randomUUID(),
        ownerId: theirs.id,
        noteState: note
      });
      await updateDraftChecked(db, ours.id, 1, { title: "mine" }, new Date(2026, 0, 1));
      await updateDraftChecked(db, other.id, 1, { title: "theirs" }, new Date(2026, 0, 9));
      expect((await newestOpenDraftForOwner(db, mine.id))?.id).toBe(ours.id);
    });
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

    // THE REGRESSION THIS SUITE EXISTS FOR.
    //
    // recordFailure used to count refused requests as failures and re-apply the
    // backoff from `now` on every call. A caller who simply kept retrying
    // therefore held their own lock open indefinitely and drove it to the
    // ceiling — and since login is keyed by IP, one script could take a whole
    // practice sharing a NAT address offline permanently, with no credentials
    // and no account. A lock has to decay while it is being hammered, or it is
    // a denial-of-service tool rather than a throttle.
    it("does not extend a live lock, however many times it is hit", async () => {
      const key = "login:hammered";
      for (let i = 0; i <= FREE_ATTEMPTS; i++) await recordFailure(db, key, now);
      const first = await checkThrottle(db, key, now);
      expect(first.locked).toBe(true);

      // 50 more attempts, spread across the lock's lifetime.
      for (let i = 1; i <= 50; i++) {
        await recordFailure(db, key, new Date(now.getTime() + i * 100));
      }

      // The deadline must not have moved: the time left is the original lock
      // minus the 5s of hammering, not a fresh (or longer) sentence.
      const after = await checkThrottle(db, key, new Date(now.getTime() + 5000));
      expect(after.retryAfterSec).toBeLessThanOrEqual(first.retryAfterSec);

      // And it genuinely ends. Past the original deadline the source is free
      // again, despite never having stopped trying.
      const past = new Date(now.getTime() + first.retryAfterSec * 1000 + 1000);
      expect((await checkThrottle(db, key, past)).locked).toBe(false);
    });

    // Anything a caller can trigger by retrying — an audit row, an email — must
    // be gated on this flag, or refusing an attempt costs us more than it costs
    // them. This is the flag that stopped the audit log being writable by
    // anyone who could reach the login form.
    it("reports justLocked only on the transition into the lock", async () => {
      const key = "login:transition";
      for (let i = 0; i < FREE_ATTEMPTS; i++) {
        expect((await recordFailure(db, key, now)).justLocked).toBe(false);
      }
      expect((await recordFailure(db, key, now)).justLocked).toBe(true);
      // Every subsequent bounce is locked, but not newly so.
      for (let i = 0; i < 5; i++) {
        const again = await recordFailure(db, key, now);
        expect(again.locked).toBe(true);
        expect(again.justLocked).toBe(false);
      }
    });

    // The IP key locks a building, not an account, so its ceiling is minutes
    // short rather than a quarter of an hour. Pinned because the constant is
    // the whole mitigation for "one temp fumbles a password and the front desk
    // cannot sign in".
    it("caps an IP lock far below the per-account ceiling", async () => {
      const key = "loginip:203.0.113.9";
      for (let i = 0; i <= IP_FREE_ATTEMPTS; i++) {
        await recordFailure(db, key, now, IP_FREE_ATTEMPTS, IP_MAX_LOCK_MS);
      }
      const state = await checkThrottle(db, key, now);
      expect(state.locked).toBe(true);
      expect(state.retryAfterSec).toBeLessThanOrEqual(IP_MAX_LOCK_MS / 1000);
    });
  });

  // Every audit column is Postgres `text` — up to a gigabyte. Some of the
  // values reaching them originate with an unauthenticated caller, and the log
  // is both rendered on a page and exported to CSV, so an unbounded row costs
  // twice. The bound lives at the single write rather than at ~30 call sites.
  describe("audit log input bounds", () => {
    it("truncates oversized values and MARKS that it did", async () => {
      await logAction(db, {
        actorId: null,
        action: "a".repeat(500),
        target: "t".repeat(5000),
        detail: "d".repeat(50_000)
      });
      const [row] = await listAuditLog(db, 1);
      expect(row.target!.length).toBeLessThan(300);
      expect(row.detail!.length).toBeLessThan(1100);
      expect(row.action.length).toBeLessThan(100);
      // A truncated value must never read as a complete fact in a record whose
      // entire purpose is being trusted later.
      expect(row.target).toContain("…[truncated]");
      expect(row.detail).toContain("…[truncated]");
    });

    it("leaves ordinary values exactly as written", async () => {
      await logAction(db, {
        actorId: "u1",
        actorName: "Dana Reyes (dreyes)",
        action: "user.role_changed",
        target: "jsmith",
        detail: "user → lead"
      });
      const [row] = await listAuditLog(db, 1);
      expect(row.actorName).toBe("Dana Reyes (dreyes)");
      expect(row.target).toBe("jsmith");
      expect(row.detail).toBe("user → lead");
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

  // The plan's highest-risk assumption: ALTER TYPE ... ADD VALUE inside a
  // guarded DO block, run by applySchema, then USED by a later statement.
  // Proven here rather than assumed, on the same engine the tests and the
  // PGlite fallback deployment use.
  it("accepts every hierarchy role after the idempotent enum migration", async () => {
    await applySchema(db); // re-run: must be a no-op, not an error
    for (const role of ["readonly", "user", "lead", "manager", "admin"] as const) {
      const u = await insertUser(db, {
        id: crypto.randomUUID(),
        username: `role-${role}`,
        displayName: role,
        role,
        passHash: "x",
        active: true
      });
      expect(u.role, role).toBe(role);
    }
  });

  describe("merge users", () => {
    // The governing rule: filed submissions are a legal record of who signed
    // them, so a merge moves LIVE work only and never rewrites attribution.
    it("moves drafts but never rewrites frozen submission attribution", async () => {
      const dupe = await freshUser("dupe");
      const keep = await freshUser("keep");
      const d1 = await insertDraft(db, { id: crypto.randomUUID(), ownerId: dupe.id, noteState: note });
      await insertDraft(db, { id: crypto.randomUUID(), ownerId: dupe.id, noteState: note });
      await fileSubmissionAtomic(
        db,
        {
          draftId: d1.id,
          submittedById: dupe.id,
          submittedByName: "Dupe (dupe)",
          submittedAtEt: "2026-06-01 10:00 ET",
          filename: "note",
          format: "md",
          ruleVersion: "2.0.0",
          auditStatus: "PASS"
        },
        d1.version,
        new Date(),
        () => ({ note: "frozen", audit: "audit" })
      );

      const res = await mergeUsers(db, dupe.id, keep.id, new Date());
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.draftsMoved).toBe(2);
      expect(res.submissionsKept).toBe(1);

      // Every draft now belongs to the surviving account...
      expect(await ownerDraftCount(db, dupe.id)).toBe(0);
      expect(await ownerDraftCount(db, keep.id)).toBe(2);
      // ...but the filed record still names who actually signed it.
      expect(await submissionCountByUser(db, dupe.id)).toBe(1);
      expect(await submissionCountByUser(db, keep.id)).toBe(0);
      const [filed] = await listAllSubmissions(db);
      expect(filed.submittedByName).toBe("Dupe (dupe)");
      // The duplicate is deactivated, not deleted — the record points at it.
      const after = await getUserByUsername(db, "dupe");
      expect(after?.active).toBe(false);
    });

    it("refuses to merge an account into itself", async () => {
      const u = await freshUser("solo");
      const res = await mergeUsers(db, u.id, u.id, new Date());
      expect(res.ok).toBe(false);
    });

    // The authority re-check inside the lock. The route checks first, but it
    // reads both rows outside the transaction, so a role change landing in
    // between would widen what the merge may touch.
    it("re-asserts the actor's ceiling inside the transaction", async () => {
      const lead = await freshUser("mlead", "lead");
      const victim = await freshUser("mvictim");
      const boss = await freshUser("mboss", "manager");

      // A Team Lead may merge two team members.
      const target = await freshUser("mkeep");
      expect((await mergeUsers(db, victim.id, target.id, new Date(), { id: lead.id, role: "lead" })).ok)
        .toBe(true);

      // ...but never a Hierarchy Manager, even if the route were bypassed.
      const v2 = await freshUser("mvictim2");
      const up = await mergeUsers(db, boss.id, v2.id, new Date(), { id: lead.id, role: "lead" });
      expect(up.ok).toBe(false);
      if (!up.ok) expect(up.reason).toBe("not-allowed");
      expect((await getUserByUsername(db, "mboss"))?.active).toBe(true);
    });

    // The puppet-account chain: mint an account whose invite you addressed to
    // yourself, then move a colleague's live work into it and edit it as them.
    it("refuses to merge work into an account the actor created", async () => {
      const lead = await freshUser("plead", "lead");
      const puppet = await insertUser(db, {
        id: crypto.randomUUID(),
        username: "puppet",
        displayName: "Puppet",
        role: "user",
        passHash: "x",
        active: true,
        createdById: lead.id
      });
      const victim = await freshUser("pvictim");
      await insertDraft(db, { id: crypto.randomUUID(), ownerId: victim.id, noteState: note });

      const res = await mergeUsers(db, victim.id, puppet.id, new Date(), { id: lead.id, role: "lead" });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.reason).toBe("not-allowed");
      // The victim keeps their work and their account.
      expect(await ownerDraftCount(db, victim.id)).toBe(1);
      expect((await getUserByUsername(db, "pvictim"))?.active).toBe(true);

      // A Smile Notes Developer is exempt — they are the trusted operator.
      expect((await mergeUsers(db, victim.id, puppet.id, new Date(), { id: "dev", role: "admin" })).ok)
        .toBe(true);
    });

    it("refuses to merge away the last active developer", async () => {
      const onlyDev = await freshUser("onlydev", "admin");
      const other = await freshUser("other");
      const res = await mergeUsers(db, onlyDev.id, other.id, new Date());
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.reason).toBe("last-admin");
      // Nothing changed.
      expect((await getUserByUsername(db, "onlydev"))?.active).toBe(true);
    });
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

  // Once sign-ins are logged they are the highest-volume event, so the viewer
  // has to be able to scope them out of the way — and, more importantly, keep
  // the FAILED sign-ins that a successful one would otherwise bury.
  it("filters the audit log by family", async () => {
    const admin = await freshUser("ida", "admin");
    await logAction(db, { actorId: admin.id, action: "auth.signin", target: "ida" });
    await logAction(db, { actorId: admin.id, action: "auth.failed", target: "ida" });
    await logAction(db, { actorId: admin.id, action: "user.create", target: "newbie" });

    expect((await listAuditLog(db, 200, "auth")).map((e) => e.action).sort()).toEqual([
      "auth.failed",
      "auth.signin"
    ]);

    // Security = everything sharp. A routine successful sign-in is dropped; a
    // failed one and every management action stay.
    const security = (await listAuditLog(db, 200, "security")).map((e) => e.action);
    expect(security).toContain("auth.failed");
    expect(security).toContain("user.create");
    expect(security).not.toContain("auth.signin");

    expect(await listAuditLog(db, 200, "all")).toHaveLength(3);
  });
});
