import { sql } from "drizzle-orm";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { schema } from "./schema";
import { SCHEMA_STATEMENTS } from "./ddl";

export type Db = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

// Apply the embedded idempotent DDL. Reliable inside the Next server bundle,
// where the file-based drizzle migrator cannot resolve the migrations folder.
export async function applySchema(db: Db): Promise<void> {
  for (const statement of SCHEMA_STATEMENTS) {
    await db.execute(sql.raw(statement));
  }
}

// One memoized bootstrap per process: pick the driver, run migrations, seed the
// first admin from env if the users table is empty. Safe for serverless cold
// starts (the migrator keeps its own __drizzle_migrations table).
let bootstrap: Promise<Db> | null = null;

async function build(): Promise<Db> {
  const url = process.env.POSTGRES_URL?.trim();
  if (url) {
    const { Pool } = await import("pg");
    const db = drizzlePg(new Pool({ connectionString: url }), { schema });
    await applySchema(db);
    await seedAdmin(db);
    return db;
  }

  if (process.env.NODE_ENV === "production") {
    // PGlite on a filesystem dir does not persist across Vercel cold starts.
    console.warn(
      "[db] POSTGRES_URL is not set in production. Falling back to PGlite; data will NOT persist. Configure Vercel Postgres/Neon."
    );
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const dir =
    process.env.NODE_ENV === "test" ? "memory://" : (process.env.PGLITE_DIR ?? ".data/pglite");
  if (dir !== "memory://" && !dir.startsWith("memory")) {
    // PGlite's own mkdir is not recursive; ensure the parent path exists.
    const { mkdirSync } = await import("node:fs");
    mkdirSync(dir, { recursive: true });
  }
  const db = drizzlePglite(new PGlite(dir), { schema });
  await applySchema(db);
  await seedAdmin(db);
  return db;
}

async function seedAdmin(db: Db): Promise<void> {
  // Same invariants as /api/setup: usernames are stored lowercase (so "Admin"
  // and "admin" can never be two people in the audit log) and the password
  // policy is not bypassable via env. A weak seed password skips the seed
  // loudly rather than creating an admin no API path would ever accept —
  // /api/setup remains available to create the first admin properly.
  const username = process.env.ADMIN_USERNAME?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) return;
  if (password.length < 10) {
    console.error(
      "[db] ADMIN_PASSWORD must be at least 10 characters; skipping first-admin seed. Use /setup or fix the env."
    );
    return;
  }
  const { countUsers, insertUser } = await import("./repo/users");
  if ((await countUsers(db)) > 0) return;
  const { hashPassword } = await import("@/lib/auth/password");
  await insertUser(db, {
    id: crypto.randomUUID(),
    username,
    displayName: username,
    role: "admin",
    passHash: await hashPassword(password),
    active: true
  });
  const { logAction } = await import("./repo/auditLog");
  await logAction(db, { actorId: null, action: "setup.first-admin", target: username });
}

export function getDb(): Promise<Db> {
  if (!bootstrap) {
    // A transient bootstrap failure (db briefly unreachable on a cold start)
    // must not be memoized forever — that would pin every future request,
    // including /setup and login, to the original error until the process
    // restarts. Clear the slot on rejection so the next request retries.
    const attempt = build();
    bootstrap = attempt;
    attempt.catch(() => {
      if (bootstrap === attempt) bootstrap = null;
    });
  }
  return bootstrap;
}

// For tests: inject a ready db and skip env bootstrap.
export function __setDbForTests(db: Db | null): void {
  bootstrap = db ? Promise.resolve(db) : null;
}
