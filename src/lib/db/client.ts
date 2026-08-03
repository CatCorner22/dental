import { sql } from "drizzle-orm";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { schema } from "./schema";
import { SCHEMA_STATEMENTS } from "./ddl";

export type Db = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

// Postgres SQLSTATEs raised when two instances run the same CREATE at once.
// IF NOT EXISTS narrows but does not close the window — the existence check and
// the create are not atomic, so a concurrent first-time bootstrap of two
// serverless instances against one database can still collide. These are the
// "someone else already created it" codes, which mean the DDL's goal is met.
const DUPLICATE_DDL_CODES = new Set([
  "42710", // duplicate_object (e.g. the role enum)
  "42P06", // duplicate_schema
  "42P07", // duplicate_table / index
  "42701", // duplicate_column
  "23505" // unique_violation on a catalog insert (pg_type, pg_class)
]);

// Apply the embedded idempotent DDL. Reliable inside the Next server bundle,
// where the file-based drizzle migrator cannot resolve the migrations folder.
// Each statement tolerates a concurrent creator: a duplicate-object error means
// the object now exists, which is exactly the desired end state, so it is
// swallowed rather than failing the whole bootstrap (which would trip the
// cooldown and flake a first multi-instance deploy). Any other error rethrows.
export async function applySchema(db: Db): Promise<void> {
  for (const statement of SCHEMA_STATEMENTS) {
    try {
      await db.execute(sql.raw(statement));
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code && DUPLICATE_DDL_CODES.has(code)) continue;
      throw e;
    }
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
    await seedOffices(db);
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
  await seedOffices(db);
  return db;
}

// Configured offices, on an empty table only. Never a reconciliation: a
// practice that renames an office through the app must not find the old name
// back after the next deploy.
async function seedOffices(db: Db): Promise<void> {
  try {
    const { seedOfficesIfEmpty } = await import("./repo/offices");
    const { OFFICE_SEEDS } = await import("@/lib/practice/config");
    await seedOfficesIfEmpty(db, OFFICE_SEEDS);
  } catch (err) {
    // A seeding failure must not take the whole app down — offices are
    // optional on every path, and an admin can add them by hand.
    console.warn("[db] office seed skipped:", err);
  }
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
  if (!/^[a-z0-9][a-z0-9._-]{2,39}$/i.test(username)) {
    console.error(
      "[db] ADMIN_USERNAME must be 3-40 letters, digits, or . _ - ; skipping first-admin seed. Use /setup or fix the env."
    );
    return;
  }
  const { hashPassword, passwordPolicyError } = await import("@/lib/auth/password");
  const pwError = passwordPolicyError(password);
  if (pwError) {
    console.error(`[db] ADMIN_PASSWORD rejected (${pwError}); skipping first-admin seed. Use /setup or fix the env.`);
    return;
  }
  const { countUsers, insertUser } = await import("./repo/users");
  if ((await countUsers(db)) > 0) return;
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

// After a failed bootstrap, wait this long before paying for another one.
// Bootstrap is expensive — connect, run every DDL statement, maybe seed — so
// a database that is down turns every incoming request into a full retry, and
// the pile of retries is exactly what keeps it down. The cooldown lets the
// failure be cheap: one attempt per window, everyone else gets the error
// immediately. Short enough that recovery is noticed within seconds.
const BOOTSTRAP_COOLDOWN_MS = 3000;
let lastFailureAt = 0;
let lastFailure: unknown = null;

export function getDb(): Promise<Db> {
  if (!bootstrap) {
    // A transient bootstrap failure (db briefly unreachable on a cold start)
    // must not be memoized forever — that would pin every future request,
    // including /setup and login, to the original error until the process
    // restarts. Clear the slot on rejection so a later request retries.
    const sinceFailure = Date.now() - lastFailureAt;
    if (lastFailure !== null && sinceFailure < BOOTSTRAP_COOLDOWN_MS) {
      return Promise.reject(lastFailure);
    }
    const attempt = build();
    bootstrap = attempt;
    attempt.then(
      () => {
        lastFailure = null;
      },
      (err) => {
        lastFailureAt = Date.now();
        lastFailure = err;
        if (bootstrap === attempt) bootstrap = null;
      }
    );
  }
  return bootstrap;
}

// For tests: inject a ready db and skip env bootstrap.
export function __setDbForTests(db: Db | null): void {
  bootstrap = db ? Promise.resolve(db) : null;
  lastFailure = null;
  lastFailureAt = 0;
}
