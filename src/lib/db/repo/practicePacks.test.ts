import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { createTestDb } from "../testDb";
import { applySchema } from "../client";
import type { Db } from "../client";
import {
  createPracticePack,
  decidePack,
  publishPack,
  submitPack
} from "./practicePacks";
import type { PackBody } from "@/lib/packs/validate";

const BODY: PackBody = {
  title: "Hygiene recall pack",
  description: "Starters for prophy days",
  moduleIds: ["preventive"],
  blockIds: ["medical-history-reviewed", "no-complications"],
  authorRoles: ["hygienist"]
};

describe("practice packs dual-control", () => {
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
    await db.execute(
      sql`TRUNCATE practice_pack_events, practice_packs RESTART IDENTITY CASCADE`
    );
  });

  it("refuses self-approve after submit", async () => {
    const author = { id: "lead-a", name: "A Lead" };
    const pack = await createPracticePack(db, BODY, author);
    const submitted = await submitPack(db, pack.id, author);
    expect(submitted.ok).toBe(true);
    const self = await decidePack(db, {
      id: pack.id,
      approve: true,
      note: "",
      actor: author
    });
    expect(self.ok).toBe(false);
    if (!self.ok) expect(self.error).toMatch(/second Team Lead/i);
  });

  it("lets a second lead approve and publish", async () => {
    const author = { id: "lead-a", name: "A Lead" };
    const reviewer = { id: "lead-b", name: "B Lead" };
    const pack = await createPracticePack(db, BODY, author);
    await submitPack(db, pack.id, author);
    const decided = await decidePack(db, {
      id: pack.id,
      approve: true,
      note: "",
      actor: reviewer
    });
    expect(decided.ok).toBe(true);
    if (!decided.ok) return;
    expect(decided.pack.status).toBe("approved");
    const published = await publishPack(db, pack.id, reviewer);
    expect(published.ok).toBe(true);
    if (!published.ok) return;
    expect(published.pack.status).toBe("published");
    expect(published.pack.publishedAt).toBeTruthy();
  });
});
