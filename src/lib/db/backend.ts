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
    // CI cross-browser smoke runs `next start` with PGLITE_DIR=memory:// on
    // purpose. Allow only that explicit in-memory path — not Vercel /tmp.
    if (
      explicitDir &&
      (explicitDir === "memory://" || explicitDir.startsWith("memory"))
    ) {
      return { kind: "pglite", dir: explicitDir };
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
