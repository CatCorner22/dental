/**
 * Decide which database driver this process may use.
 *
 * Production MUST have POSTGRES_URL. A silent PGlite fallback on Vercel looks
 * healthy until the next cold start wipes users, drafts, and filings — that
 * failure mode is worse than a loud boot error.
 */

export type DbBackend =
  | { kind: "postgres"; url: string }
  | { kind: "pglite"; dir: string }
  | { kind: "reject"; reason: string };

export function resolveDbBackend(
  env: Record<string, string | undefined> = process.env
): DbBackend {
  const url = env.POSTGRES_URL?.trim();
  if (url) return { kind: "postgres", url };

  if (env.NODE_ENV === "production") {
    const explicitDir = env.PGLITE_DIR?.trim();
    // THE EPHEMERAL ESCAPE HATCH NEEDS TWO HANDS ON IT.
    //
    // CI's smoke tests and the local e2e battery legitimately run `next start`
    // (which sets NODE_ENV=production) against an in-memory database. But
    // `PGLITE_DIR=memory://` alone used to be enough, and that is a one-line
    // paste away from a catastrophe: this repo's own .env.local carries that
    // exact line, and an operator who copies their working local env into the
    // Vercel dashboard gets a deployment that looks perfectly healthy — logins
    // work, notes save, history renders — while every isolate holds its own
    // empty database that is wiped on the next cold start. Silent, total,
    // ongoing loss of clinical records.
    //
    // A test harness can afford to say so explicitly. An operator pasting env
    // vars never types ALLOW_EPHEMERAL_DB=1 by accident.
    if (explicitDir === "memory://" && env.ALLOW_EPHEMERAL_DB === "1") {
      return { kind: "pglite", dir: explicitDir };
    }
    if (explicitDir === "memory://") {
      return {
        kind: "reject",
        reason:
          "PGLITE_DIR=memory:// in production would give every instance its own empty database, wiped on each cold start — clinical records would disappear silently. Set POSTGRES_URL. (Test harnesses that really do want a throwaway database must also set ALLOW_EPHEMERAL_DB=1.)"
      };
    }
    return {
      kind: "reject",
      reason:
        "POSTGRES_URL is required in production. PGlite under /tmp does not persist across Vercel cold starts — configure Neon/Vercel Postgres (pooled connection string)."
    };
  }

  const dir =
    env.NODE_ENV === "test"
      ? "memory://"
      : (env.PGLITE_DIR ??
        (env.VERCEL ? "/tmp/smile-notes-pglite" : ".data/pglite"));
  return { kind: "pglite", dir };
}

/**
 * node-pg Pool options sized for serverless isolates (Vercel + Neon).
 * Default max=1 avoids connection storms when many isolates each open a pool.
 * Override with PG_POOL_MAX when running a long-lived Node server.
 */
export function postgresPoolOptions(
  connectionString: string,
  env: Record<string, string | undefined> = process.env
) {
  const parsed = Number(env.PG_POOL_MAX);
  const max = Number.isFinite(parsed) && parsed >= 1 ? Math.min(Math.floor(parsed), 10) : 1;
  return {
    connectionString,
    max,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: true as const
  };
}
