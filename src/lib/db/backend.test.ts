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

  it("allows PGlite in development and test", () => {
    expect(resolveDbBackend({ NODE_ENV: "development" }).kind).toBe("pglite");
    expect(resolveDbBackend({ NODE_ENV: "test" })).toEqual({
      kind: "pglite",
      dir: "memory://"
    });
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
