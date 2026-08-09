import { describe, expect, it } from "vitest";
import { postgresPoolOptions, resolveDbBackend } from "./backend";

describe("resolveDbBackend", () => {
  it("prefers POSTGRES_URL when set", () => {
    expect(
      resolveDbBackend({ POSTGRES_URL: " postgresql://u:p@h/db ", NODE_ENV: "production" })
    ).toEqual({ kind: "postgres", url: "postgresql://u:p@h/db" });
  });

  it("rejects production without POSTGRES_URL — no silent PGlite", () => {
    const b = resolveDbBackend({ NODE_ENV: "production" });
    expect(b.kind).toBe("reject");
    if (b.kind === "reject") expect(b.reason).toMatch(/POSTGRES_URL/);
  });

  // This case USED to allow memory:// in production on PGLITE_DIR alone, which
  // is the operator-paste trap. CI and the local battery now declare
  // ALLOW_EPHEMERAL_DB=1; see the two cases at the end of this block.
  it("allows explicit memory:// PGlite in production for a declared harness", () => {
    expect(
      resolveDbBackend({
        NODE_ENV: "production",
        PGLITE_DIR: "memory://",
        ALLOW_EPHEMERAL_DB: "1"
      })
    ).toEqual({ kind: "pglite", dir: "memory://" });
  });

  it("rejects memory-like paths that are not memory:// URIs", () => {
    for (const dir of [
      "memory-mapped-disk:/tmp/smile-notes-pglite",
      "memory://tmp/smile-notes-pglite"
    ]) {
      const b = resolveDbBackend({
        NODE_ENV: "production",
        PGLITE_DIR: dir
      });
      expect(b.kind).toBe("reject");
    }
  });

  it("still rejects Vercel production without POSTGRES_URL even if PGLITE_DIR is set", () => {
    const b = resolveDbBackend({
      NODE_ENV: "production",
      VERCEL: "1",
      PGLITE_DIR: "/tmp/smile-notes-pglite"
    });
    expect(b.kind).toBe("reject");
  });

  it("allows PGlite in development and test", () => {
    expect(resolveDbBackend({ NODE_ENV: "development" }).kind).toBe("pglite");
    expect(resolveDbBackend({ NODE_ENV: "test" })).toEqual({
      kind: "pglite",
      dir: "memory://"
    });
  });

  // The one-line paste that would have shipped a self-wiping deployment: this
  // repo's own .env.local carries PGLITE_DIR=memory://, and production used to
  // accept it — every isolate holding its own empty database, cleared on each
  // cold start, while the app looked perfectly healthy.
  it("refuses an in-memory database in production without a deliberate opt-in", () => {
    const got = resolveDbBackend({ NODE_ENV: "production", PGLITE_DIR: "memory://" });
    expect(got.kind).toBe("reject");
    expect(got.kind === "reject" && got.reason).toMatch(/cold start|POSTGRES_URL/i);
  });

  it("allows an in-memory database in production only for a harness that says so", () => {
    expect(
      resolveDbBackend({
        NODE_ENV: "production",
        PGLITE_DIR: "memory://",
        ALLOW_EPHEMERAL_DB: "1"
      })
    ).toEqual({ kind: "pglite", dir: "memory://" });
  });

  it("still prefers POSTGRES_URL over any ephemeral opt-in", () => {
    expect(
      resolveDbBackend({
        NODE_ENV: "production",
        PGLITE_DIR: "memory://",
        ALLOW_EPHEMERAL_DB: "1",
        POSTGRES_URL: "postgres://h/db"
      })
    ).toEqual({ kind: "postgres", url: "postgres://h/db" });
  });
});

describe("postgresPoolOptions", () => {
  it("defaults to max=1 for serverless isolates", () => {
    expect(postgresPoolOptions("postgres://h/db", {}).max).toBe(1);
    expect(postgresPoolOptions("postgres://h/db", {}).connectionTimeoutMillis).toBe(10_000);
  });

  it("honors PG_POOL_MAX within a hard ceiling", () => {
    expect(postgresPoolOptions("postgres://h/db", { PG_POOL_MAX: "4" }).max).toBe(4);
    expect(postgresPoolOptions("postgres://h/db", { PG_POOL_MAX: "99" }).max).toBe(10);
  });
});
