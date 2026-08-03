import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { createTestDb } from "./testDb";
import { applySchema } from "./client";
import type { Db } from "./client";
import {
  awardForSubmission,
  awardOnce,
  balanceFor,
  decideRedemption,
  listRedemptions,
  listStoreItems,
  requestRedemption,
  seedStoreIfEmpty,
  upsertStoreItem,
  xpFor
} from "./repo/gamify";
import { STARTER_STORE } from "@/lib/gamify/economy";

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  const t = await createTestDb();
  db = t.db;
  close = t.close;
  await applySchema(db);
});

afterAll(async () => {
  await close();
});

beforeEach(async () => {
  await db.execute(sql`DELETE FROM points_ledger`);
  await db.execute(sql`DELETE FROM redemptions`);
  await db.execute(sql`DELETE FROM store_items`);
});

describe("the ledger", () => {
  it("pays a submission exactly once, however many times the award retries", async () => {
    const first = await awardForSubmission(db, { userId: "u1", submissionId: 7, gpa: 3.8, streak: 1 });
    expect(first).toBe(150);
    const replay = await awardForSubmission(db, { userId: "u1", submissionId: 7, gpa: 3.8, streak: 1 });
    expect(replay).toBeNull();
    expect(await balanceFor(db, "u1")).toBe(150);
  });

  it("an F pays nothing and writes nothing", async () => {
    expect(await awardForSubmission(db, { userId: "u1", submissionId: 9, gpa: 1.0, streak: 0 })).toBeNull();
    expect(await balanceFor(db, "u1")).toBe(0);
  });

  it("badge bonuses pay once per badge", async () => {
    expect(
      await awardOnce(db, { userId: "u1", refType: "badge", refId: "century-mark", points: 500, reason: "badge:century-mark" })
    ).toBe(true);
    expect(
      await awardOnce(db, { userId: "u1", refType: "badge", refId: "century-mark", points: 500, reason: "badge:century-mark" })
    ).toBe(false);
    expect(await balanceFor(db, "u1")).toBe(500);
  });

  it("XP counts only what was earned — spending cannot demote", async () => {
    await awardForSubmission(db, { userId: "u1", submissionId: 1, gpa: 3.8, streak: 0 });
    await seedStoreIfEmpty(db, STARTER_STORE);
    // Give enough balance to redeem, then redeem.
    await awardOnce(db, { userId: "u1", refType: "badge", refId: "x", points: 1000, reason: "badge:x" });
    const items = await listStoreItems(db);
    const coffee = items.find((i) => i.tier === 1)!;
    const res = await requestRedemption(db, { userId: "u1", userName: "U One (u1)", itemId: coffee.id });
    expect(res.ok).toBe(true);
    expect(await balanceFor(db, "u1")).toBe(1150 - coffee.cost);
    expect(await xpFor(db, "u1")).toBe(1150); // untouched by the spend
  });
});

describe("the store", () => {
  it("seeds once and only when empty", async () => {
    await seedStoreIfEmpty(db, STARTER_STORE);
    await seedStoreIfEmpty(db, STARTER_STORE);
    expect((await listStoreItems(db)).length).toBe(STARTER_STORE.length);
  });

  it("refuses a redemption the balance cannot cover, atomically", async () => {
    await seedStoreIfEmpty(db, STARTER_STORE);
    const items = await listStoreItems(db);
    const res = await requestRedemption(db, { userId: "poor", userName: "P (poor)", itemId: items[0].id });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/balance/);
    expect(await balanceFor(db, "poor")).toBe(0);
    expect((await listRedemptions(db, "poor")).length).toBe(0);
  });

  it("a decline refunds by appending and requires a note", async () => {
    await seedStoreIfEmpty(db, STARTER_STORE);
    await awardOnce(db, { userId: "u2", refType: "badge", refId: "seed", points: 600, reason: "seed" });
    const coffee = (await listStoreItems(db)).find((i) => i.tier === 1)!;
    const req = await requestRedemption(db, { userId: "u2", userName: "U Two (u2)", itemId: coffee.id });
    expect(req.ok).toBe(true);
    const id = req.ok ? req.redemption.id : 0;

    const noNote = await decideRedemption(db, {
      id,
      approve: false,
      decidedById: "lead-1",
      decidedByName: "Lead",
      note: "  "
    });
    expect(noNote.ok).toBe(false);

    const declined = await decideRedemption(db, {
      id,
      approve: false,
      decidedById: "lead-1",
      decidedByName: "Lead",
      note: "Out of stock this week."
    });
    expect(declined.ok).toBe(true);
    expect(await balanceFor(db, "u2")).toBe(600); // refunded by a new row
    const rows = await listRedemptions(db, "u2");
    expect(rows[0].status).toBe("declined");
    expect(rows[0].decidedNote).toBe("Out of stock this week.");
  });

  it("a decision is final — no double-decide", async () => {
    await seedStoreIfEmpty(db, STARTER_STORE);
    await awardOnce(db, { userId: "u3", refType: "badge", refId: "seed", points: 600, reason: "seed" });
    const coffee = (await listStoreItems(db)).find((i) => i.tier === 1)!;
    const req = await requestRedemption(db, { userId: "u3", userName: "U Three (u3)", itemId: coffee.id });
    const id = req.ok ? req.redemption.id : 0;
    expect(
      (await decideRedemption(db, { id, approve: true, decidedById: "lead-1", decidedByName: "Lead", note: "" })).ok
    ).toBe(true);
    expect(
      (await decideRedemption(db, { id, approve: false, decidedById: "lead-1", decidedByName: "Lead", note: "no" })).ok
    ).toBe(false);
  });

  it("a lead cannot approve their own redemption", async () => {
    await seedStoreIfEmpty(db, STARTER_STORE);
    await awardOnce(db, { userId: "lead-self", refType: "badge", refId: "seed", points: 600, reason: "seed" });
    const coffee = (await listStoreItems(db)).find((i) => i.tier === 1)!;
    const req = await requestRedemption(db, {
      userId: "lead-self",
      userName: "Lead Self (lead-self)",
      itemId: coffee.id
    });
    const id = req.ok ? req.redemption.id : 0;
    const self = await decideRedemption(db, {
      id,
      approve: true,
      decidedById: "lead-self",
      decidedByName: "Lead Self",
      note: ""
    });
    expect(self.ok).toBe(false);
    if (!self.ok) expect(self.error).toMatch(/own store request/i);
  });

  it("concurrent redemptions cannot overspend the same balance", async () => {
    await seedStoreIfEmpty(db, STARTER_STORE);
    const coffee = (await listStoreItems(db)).find((i) => i.tier === 1)!;
    await awardOnce(db, {
      userId: "race",
      refType: "badge",
      refId: "seed",
      points: coffee.cost,
      reason: "seed"
    });
    const [a, b] = await Promise.all([
      requestRedemption(db, { userId: "race", userName: "R (race)", itemId: coffee.id }),
      requestRedemption(db, { userId: "race", userName: "R (race)", itemId: coffee.id })
    ]);
    const wins = [a, b].filter((r) => r.ok).length;
    const losses = [a, b].filter((r) => !r.ok).length;
    expect(wins).toBe(1);
    expect(losses).toBe(1);
    expect(await balanceFor(db, "race")).toBe(0);
  });

  it("upsert edits an item in place", async () => {
    const created = await upsertStoreItem(db, { title: "Test", detail: "", cost: 100, tier: 1, active: true });
    const updated = await upsertStoreItem(db, { id: created.id, title: "Test2", detail: "", cost: 200, tier: 2, active: false });
    expect(updated.title).toBe("Test2");
    expect((await listStoreItems(db)).length).toBe(0); // inactive hidden
    expect((await listStoreItems(db, true)).length).toBe(1);
  });
});
