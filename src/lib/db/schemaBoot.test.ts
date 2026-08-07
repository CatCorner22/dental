import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureSchema, parseSchemaBootVersion } from "./client";
import { SCHEMA_BOOT_VERSION } from "./ddl";
import { createTestDb } from "./testDb";
import type { Db } from "./client";

describe("parseSchemaBootVersion", () => {
  it("reads array-shaped execute results", () => {
    expect(parseSchemaBootVersion([{ version: 1 }])).toBe(1);
    expect(parseSchemaBootVersion([{ version: "3" }])).toBe(3);
  });

  it("reads { rows } shaped execute results", () => {
    expect(parseSchemaBootVersion({ rows: [{ version: 2 }] })).toBe(2);
  });

  it("returns null when missing or unreadable", () => {
    expect(parseSchemaBootVersion([])).toBeNull();
    expect(parseSchemaBootVersion({})).toBeNull();
    expect(parseSchemaBootVersion([{ version: "x" }])).toBeNull();
  });
});

describe("ensureSchema", () => {
  let db: Db;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const t = await createTestDb();
    db = t.db;
    close = t.close;
  });
  afterAll(async () => {
    if (close) await close();
  });

  it("skips when SCHEMA_BOOT_VERSION already matches after bootstrap", async () => {
    // createTestDb runs applySchema; ensureSchema stamps the boot version, then skips.
    expect(await ensureSchema(db)).toBe("applied");
    expect(await ensureSchema(db)).toBe("skipped");
    expect(SCHEMA_BOOT_VERSION).toBeGreaterThanOrEqual(1);
  });
});
