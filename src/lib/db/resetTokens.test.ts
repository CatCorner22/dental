import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { createTestDb } from "./testDb";
import type { Db } from "./client";
import { getUserById, insertUser } from "./repo/users";
import {
  findLiveResetToken,
  insertResetToken,
  invalidateUserResetTokens,
  pruneResetTokens,
  redeemResetToken,
  setPasswordAndRevokeLinks
} from "./repo/resetTokens";
import { generateResetToken, hashResetToken, resetTokenExpiry } from "@/lib/auth/resetToken";
import { isResetLinkDeadMessage, RESET_LINK_DEAD_MESSAGE } from "@/lib/auth/resetDeadLink";

// The reset-token lifecycle against a real (in-memory) Postgres. This is the
// positive half the browser drive cannot reach: issuing a link requires a
// mail provider by design, so the token mechanics — single use, sibling
// retirement, the watermark bump that kills existing sessions — are proven
// here at the repo layer, where the /api/reset route reads and writes.
let db: Db;
let close: () => Promise<void>;

const NOW = new Date("2026-08-09T12:00:00Z");

async function freshUser(username: string) {
  return insertUser(db, {
    id: crypto.randomUUID(),
    username,
    displayName: username,
    role: "user",
    passHash: "old-hash",
    active: true
  });
}

async function issue(userId: string, at: Date) {
  const token = generateResetToken();
  const id = crypto.randomUUID();
  await invalidateUserResetTokens(db, userId, at);
  await insertResetToken(db, {
    id,
    userId,
    tokenHash: hashResetToken(token),
    expiresAt: resetTokenExpiry(at),
    createdById: null
  });
  return { id, token };
}

describe("reset-token lifecycle (PGlite)", () => {
  beforeAll(async () => {
    const t = await createTestDb();
    db = t.db;
    close = t.close;
  });
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE password_reset_tokens, users RESTART IDENTITY CASCADE`);
  });
  afterAll(async () => {
    if (close) await close();
  });

  it("redeems once, sets the password, and bumps the session watermark", async () => {
    const u = await freshUser("dana");
    const { id, token } = await issue(u.id, NOW);

    const live = await findLiveResetToken(db, hashResetToken(token), NOW);
    expect(live?.id).toBe(id);

    const ok = await redeemResetToken(db, id, u.id, "new-hash", NOW);
    expect(ok).toBe(true);

    const after = await getUserById(db, u.id);
    expect(after?.passHash).toBe("new-hash");
    // The watermark: every session minted before this instant must die.
    expect(after?.passwordChangedAt?.getTime()).toBe(NOW.getTime());
  });

  it("refuses the second redemption of the same link (forwarded-link race)", async () => {
    const u = await freshUser("dana");
    const { id } = await issue(u.id, NOW);
    expect(await redeemResetToken(db, id, u.id, "first-winner", NOW)).toBe(true);
    expect(await redeemResetToken(db, id, u.id, "second-loser", NOW)).toBe(false);
    expect((await getUserById(db, u.id))?.passHash).toBe("first-winner");
  });

  it("issuing a new link retires the old one, and redeeming retires every sibling", async () => {
    const u = await freshUser("dana");
    const first = await issue(u.id, NOW);
    const second = await issue(u.id, NOW); // invalidates first
    expect(await findLiveResetToken(db, hashResetToken(first.token), NOW)).toBeUndefined();
    expect(await findLiveResetToken(db, hashResetToken(second.token), NOW)).toBeDefined();

    // Simulate the race the redeem transaction defends against: a sibling
    // inserted WITHOUT the invalidation step, so two tokens are live at once.
    const rogue = generateResetToken();
    await insertResetToken(db, {
      id: crypto.randomUUID(),
      userId: u.id,
      tokenHash: hashResetToken(rogue),
      expiresAt: resetTokenExpiry(NOW),
      createdById: null
    });
    expect(await redeemResetToken(db, second.id, u.id, "new-hash", NOW)).toBe(true);
    expect(await findLiveResetToken(db, hashResetToken(rogue), NOW)).toBeUndefined();
  });

  it("an expired token is not live, even untouched", async () => {
    const u = await freshUser("dana");
    const { token } = await issue(u.id, NOW);
    const after = new Date(resetTokenExpiry(NOW).getTime() + 1);
    expect(await findLiveResetToken(db, hashResetToken(token), after)).toBeUndefined();
  });

  it("any password write revokes outstanding links (the remediation actually remediates)", async () => {
    const u = await freshUser("dana");
    const { token } = await issue(u.id, NOW);
    await setPasswordAndRevokeLinks(db, u.id, "self-service-hash", NOW);
    expect(await findLiveResetToken(db, hashResetToken(token), NOW)).toBeUndefined();
  });

  it("prunes only what carries no information", async () => {
    const u = await freshUser("dana");
    const { token } = await issue(u.id, NOW);
    // Expiry is NOW+1h and the prune cutoff is now-24h with a strict <, so
    // the first instant the row is prunable is just past NOW+25h.
    const dayLater = new Date(NOW.getTime() + 26 * 60 * 60 * 1000);
    await pruneResetTokens(db, NOW);
    expect(await findLiveResetToken(db, hashResetToken(token), NOW)).toBeDefined();
    await pruneResetTokens(db, dayLater);
    // Now >24h past expiry — gone entirely, not merely dead.
    const rows = await db.execute(sql`SELECT count(*)::int AS n FROM password_reset_tokens`);
    expect((rows.rows[0] as { n: number }).n).toBe(0);
  });
});

describe("dead-link sentinel", () => {
  it("matches exactly the sentence the route sends", () => {
    // Both sides import the constant; this pins the CONTRACT so a copy edit
    // that forks them fails a test instead of silently un-terminating the
    // dead-link panel.
    expect(isResetLinkDeadMessage(RESET_LINK_DEAD_MESSAGE)).toBe(true);
    expect(isResetLinkDeadMessage("This link is no longer valid.")).toBe(false);
    expect(isResetLinkDeadMessage(undefined)).toBe(false);
    expect(isResetLinkDeadMessage("The two passwords do not match.")).toBe(false);
  });
});
