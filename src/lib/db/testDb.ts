import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { schema } from "./schema";
import { applySchema, type Db } from "./client";

// A fresh in-memory Postgres per call, with the same embedded DDL the runtime
// applies. One per test file; call close() in afterAll.
export async function createTestDb(): Promise<{ db: Db; close: () => Promise<void> }> {
  const client = new PGlite("memory://");
  const db = drizzle(client, { schema });
  await applySchema(db);
  return { db, close: () => client.close() };
}
