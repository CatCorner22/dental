import { sql } from "drizzle-orm";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { schema } from "./schema";
import { SCHEMA_BOOT_VERSION, SCHEMA_STATEMENTS } from "./ddl";
import { pinPostgresSslMode } from "./postgresUrl";
import { postgresPoolOptions, resolveDbBackend } from "./backend";

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

/** Normalize drizzle/node-pg/PGlite execute shapes to a version integer. */
export function parseSchemaBootVersion(result: unknown): number | null {
  const rows = Array.isArray(result)
    ? result
    : result &&
        typeof result === "object" &&
        Array.isArray((result as { rows?: unknown }).rows)
      ? (result as { rows: unknown[] }).rows
      : [];
  const first = rows[0] as { version?: unknown } | undefined;
  const v = first?.version;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && /^\d+$/.test(v)) return Number(v);
  return null;
}

async function readSchemaBootVersion(db: Db): Promise<number | null> {
  try {
    const result = await db.execute(sql`SELECT version FROM schema_boot WHERE id = 1 LIMIT 1`);
    return parseSchemaBootVersion(result);
  } catch {
    // Table missing on first boot, or a half-applied schema — fall through to
    // the full DDL loop rather than treating "unknown" as "current".
    return null;
  }
}

async function writeSchemaBootVersion(db: Db): Promise<void> {
  await db.execute(sql`
    INSERT INTO schema_boot (id, version, applied_at)
    VALUES (1, ${SCHEMA_BOOT_VERSION}, NOW())
    ON CONFLICT (id) DO UPDATE
      SET version = EXCLUDED.version,
          applied_at = EXCLUDED.applied_at
  `);
}

/**
 * Apply DDL only when this database has not yet recorded SCHEMA_BOOT_VERSION.
 * Warm isolates already memoize getDb(); this cuts ~55 round-trips on every
 * *new* serverless isolate after the first successful apply.
 */
export async function ensureSchema(db: Db): Promise<"skipped" | "applied"> {
  const current = await readSchemaBootVersion(db);
  if (current === SCHEMA_BOOT_VERSION) return "skipped";
  await applySchema(db);
  await writeSchemaBootVersion(db);
  return "applied";
}

// One memoized bootstrap per process — held on globalThis, NOT in module
// scope, and the difference is load-bearing.
//
// Next bundles this file into more than one webpack layer: pages and API
// routes share one module instance, and a Server Action gets another. A
// `let bootstrap` at module scope is therefore one memo PER LAYER. Against
// Postgres that only means an extra pool; against PGlite with
// PGLITE_DIR=memory:// it means two separate in-memory databases, each
// seeding its own first admin with its own random id — so signing in through
// the login action minted a session whose user id existed only in the
// action layer's database, and every page render answered "This session is
// no longer valid". CI's cross-browser smoke caught it the first time the
// smoke logged in through the action form. globalThis is process-wide, so
// every layer resolves the same database.
const g = globalThis as typeof globalThis & {
  __smileNotesDb?: {
    bootstrap: Promise<Db> | null;
    lastFailureAt: number;
    lastFailure: unknown;
  };
};
g.__smileNotesDb ??= { bootstrap: null, lastFailureAt: 0, lastFailure: null };
const slot = g.__smileNotesDb;

async function build(): Promise<Db> {
  const backend = resolveDbBackend();
  if (backend.kind === "reject") {
    // Loud failure beats silent data loss on the next cold start.
    throw new Error(`[db] ${backend.reason}`);
  }

  if (backend.kind === "postgres") {
    const { Pool } = await import("pg");
    // Neon ships sslmode=require; pin verify-full so node-pg stops warning
    // and we keep today's certificate checks when pg v9 changes the alias.
    // Pool max defaults to 1 per isolate — see postgresPoolOptions.
    const db = drizzlePg(
      new Pool(postgresPoolOptions(pinPostgresSslMode(backend.url))),
      { schema }
    );
    await ensureSchema(db);
    await seedAdmin(db);
    await sweepMfaWhileDisabled(db);
    await seedOffices(db);
    return db;
  }

  const { PGlite } = await import("@electric-sql/pglite");
  // Vercel's serverless FS is read-only except /tmp. A relative `.data/pglite`
  // mkdir fails with ENOENT and takes login down with it. Prefer an explicit
  // PGLITE_DIR, then /tmp on Vercel, then the local default — but never in
  // production (resolveDbBackend rejects that path).
  const dir = backend.dir;
  if (dir !== "memory://" && !dir.startsWith("memory")) {
    // PGlite's own mkdir is not recursive; ensure the parent path exists.
    const { mkdirSync } = await import("node:fs");
    mkdirSync(dir, { recursive: true });
  }
  const db = drizzlePglite(new PGlite(dir), { schema });
  await ensureSchema(db);
  await seedAdmin(db);
  await sweepMfaWhileDisabled(db);
  await seedOffices(db);
  return db;
}

// While the deployment-level MFA switch is off, stale enrollments are cleared
// at bootstrap. Login already skips the code check when the switch is off, so
// this is not what unlocks anyone — it exists so flipping MFA_ENABLED=1 later
// starts from zero enrollments instead of resurrecting a factor whose device
// may be long gone. Failure here must not take the app down.
async function sweepMfaWhileDisabled(db: Db): Promise<void> {
  try {
    const { mfaFeatureEnabled } = await import("@/lib/auth/mfaFeature");
    if (mfaFeatureEnabled()) return;
    const { clearAllMfa } = await import("./repo/users");
    const cleared = await clearAllMfa(db);
    if (cleared.length === 0) return;
    const { logAction } = await import("./repo/auditLog");
    await logAction(db, {
      actorId: null,
      action: "setup.mfa-sweep",
      target: cleared.join(", "),
      detail: "second factors cleared: MFA is turned off on this deployment"
    });
    console.warn(`[db] MFA disabled on this deployment; cleared enrollment for: ${cleared.join(", ")}`);
  } catch (err) {
    console.warn("[db] MFA sweep skipped:", err);
  }
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
  const { usernamePolicyError } = await import("@/lib/auth/username");
  const userError = usernamePolicyError(username);
  if (userError) {
    console.error(`[db] ADMIN_USERNAME rejected (${userError}); skipping first-admin seed. Use /setup or fix the env.`);
    return;
  }
  const { hashPassword, passwordPolicyError } = await import("@/lib/auth/password");
  const pwError = passwordPolicyError(password);
  if (pwError) {
    console.error(`[db] ADMIN_PASSWORD rejected (${pwError}); skipping first-admin seed. Use /setup or fix the env.`);
    return;
  }
  const { countUsers, getUserByUsername, insertUser } = await import("./repo/users");
  const { logAction } = await import("./repo/auditLog");

  // One-shot recovery for a locked-out site owner: set ADMIN_PASSWORD_RESET=1
  // with ADMIN_USERNAME + ADMIN_PASSWORD, redeploy once, sign in, then REMOVE
  // the flag. Without the flag, a non-empty users table is left alone.
  const resetRequested = process.env.ADMIN_PASSWORD_RESET?.trim() === "1";
  if (resetRequested) {
    const existing = await getUserByUsername(db, username);
    if (!existing) {
      console.error(
        `[db] ADMIN_PASSWORD_RESET=1 but no user "${username}" exists; skipping. Create via /setup or fix ADMIN_USERNAME.`
      );
      return;
    }
    if (existing.role !== "admin") {
      console.error(
        `[db] ADMIN_PASSWORD_RESET=1 refuses to rewrite a non-Developer account ("${username}" is ${existing.role}).`
      );
      return;
    }
    // passwordChangedAt kills any leftover session cookies from the failed
    // setup attempts — same rule as an in-app admin password reset.
    const { setPasswordAndRevokeLinks } = await import("./repo/resetTokens");
    await setPasswordAndRevokeLinks(db, existing.id, await hashPassword(password), new Date());
    // Clear the second factor too. This flag exists for exactly one scenario —
    // the site owner cannot sign in and there is no other Developer to help —
    // and an enabled authenticator locks that owner out just as completely as
    // a lost password. Resetting one but not the other left the break-glass
    // path broken for the person it was built for (a live lockout proved it).
    const { updateUser } = await import("./repo/users");
    await updateUser(db, existing.id, { mfaEnabled: false, mfaSecret: null });
    await logAction(db, {
      actorId: null,
      action: "setup.admin-password-reset",
      target: username,
      detail: "ADMIN_PASSWORD_RESET=1 — password reset, second factor cleared; remove this env flag after sign-in"
    });
    console.warn(
      `[db] Reset password and cleared MFA for Developer "${username}" via ADMIN_PASSWORD_RESET. Remove that env flag now.`
    );
    return;
  }

  if ((await countUsers(db)) > 0) return;
  await insertUser(db, {
    id: crypto.randomUUID(),
    username,
    displayName: username,
    role: "admin",
    passHash: await hashPassword(password),
    active: true
  });
  await logAction(db, { actorId: null, action: "setup.first-admin", target: username });
}

// After a failed bootstrap, wait this long before paying for another one.
// Bootstrap is expensive — connect, run every DDL statement, maybe seed — so
// a database that is down turns every incoming request into a full retry, and
// the pile of retries is exactly what keeps it down. The cooldown lets the
// failure be cheap: one attempt per window, everyone else gets the error
// immediately. Short enough that recovery is noticed within seconds.
const BOOTSTRAP_COOLDOWN_MS = 3000;

export function getDb(): Promise<Db> {
  if (!slot.bootstrap) {
    // A transient bootstrap failure (db briefly unreachable on a cold start)
    // must not be memoized forever — that would pin every future request,
    // including /setup and login, to the original error until the process
    // restarts. Clear the slot on rejection so a later request retries.
    const sinceFailure = Date.now() - slot.lastFailureAt;
    if (slot.lastFailure !== null && sinceFailure < BOOTSTRAP_COOLDOWN_MS) {
      return Promise.reject(slot.lastFailure);
    }
    const attempt = build();
    slot.bootstrap = attempt;
    attempt.then(
      () => {
        slot.lastFailure = null;
      },
      (err) => {
        slot.lastFailureAt = Date.now();
        slot.lastFailure = err;
        if (slot.bootstrap === attempt) slot.bootstrap = null;
      }
    );
  }
  return slot.bootstrap;
}

// For tests: inject a ready db and skip env bootstrap.
export function __setDbForTests(db: Db | null): void {
  slot.bootstrap = db ? Promise.resolve(db) : null;
  slot.lastFailure = null;
  slot.lastFailureAt = 0;
}
