import { describe, expect, it } from "vitest";
import { pinPostgresSslMode } from "./postgresUrl";

describe("pinPostgresSslMode", () => {
  it("rewrites Neon-style sslmode=require to verify-full", () => {
    const inUrl =
      "postgresql://u:p@ep-x.us-east-1.aws.neon.tech/neondb?sslmode=require";
    expect(pinPostgresSslMode(inUrl)).toBe(
      "postgresql://u:p@ep-x.us-east-1.aws.neon.tech/neondb?sslmode=verify-full"
    );
  });

  it("rewrites prefer and verify-ca the same way", () => {
    expect(pinPostgresSslMode("postgres://h/db?sslmode=prefer")).toContain(
      "sslmode=verify-full"
    );
    expect(pinPostgresSslMode("postgres://h/db?sslmode=verify-ca")).toContain(
      "sslmode=verify-full"
    );
  });

  // This case USED to assert that a non-Neon URL without sslmode was left
  // alone — i.e. it pinned the plaintext bug as intended behavior. A bare
  // remote host now gets verify-full; only an explicit verify-full is a no-op.
  it("leaves an already-pinned url alone and pins a bare remote host", () => {
    const full = "postgres://db.example.com/db?sslmode=verify-full";
    expect(pinPostgresSslMode(full)).toBe(full);
    expect(pinPostgresSslMode("postgres://db.example.com/db")).toBe(
      "postgres://db.example.com/db?sslmode=verify-full"
    );
  });

  it("preserves sibling query params", () => {
    const inUrl = "postgres://h/db?channel_binding=require&sslmode=require&foo=1";
    expect(pinPostgresSslMode(inUrl)).toBe(
      "postgres://h/db?channel_binding=require&sslmode=verify-full&foo=1"
    );
  });

  it("strips wrapping quotes so a pasted Vercel secret still rewrites", () => {
    const inUrl =
      "'postgresql://u:p@ep-x.us-east-1.aws.neon.tech/neondb?sslmode=require'";
    expect(pinPostgresSslMode(inUrl)).toBe(
      "postgresql://u:p@ep-x.us-east-1.aws.neon.tech/neondb?sslmode=verify-full"
    );
  });

  it("adds sslmode=verify-full when a Neon URL omits it", () => {
    const bare = "postgresql://u:p@ep-x.us-east-1.aws.neon.tech/neondb";
    expect(pinPostgresSslMode(bare)).toBe(
      "postgresql://u:p@ep-x.us-east-1.aws.neon.tech/neondb?sslmode=verify-full"
    );
    const withOther =
      "postgresql://u:p@ep-x.us-east-1.aws.neon.tech/neondb?channel_binding=require";
    expect(pinPostgresSslMode(withOther)).toBe(
      "postgresql://u:p@ep-x.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=verify-full"
    );
  });

  // The provider in the URL never decided whether the wire needs encrypting —
  // whether the bytes leave the machine does. Pinning only *.neon.tech meant a
  // Supabase/RDS/Railway/self-hosted string without ?sslmode= fell through to
  // node-pg's default of NO TLS, carrying clinical notes in plaintext.
  it("adds sslmode=verify-full for ANY remote host that omits it", () => {
    for (const host of [
      "db.abcdefgh.supabase.co",
      "mydb.cluster-xyz.us-east-1.rds.amazonaws.com",
      "containers-us-west-1.railway.app:6543",
      "postgres.internal.example.com"
    ]) {
      const out = pinPostgresSslMode(`postgresql://u:p@${host}/appdb`);
      expect(out, host).toContain("sslmode=verify-full");
    }
  });

  it("respects an sslmode the operator set deliberately", () => {
    expect(pinPostgresSslMode("postgresql://u:p@db.example.com/appdb?sslmode=disable")).toBe(
      "postgresql://u:p@db.example.com/appdb?sslmode=disable"
    );
  });

  // Loopback never reaches a network and local Postgres has no certificate to
  // verify: forcing TLS there breaks development while protecting nothing.
  it("leaves loopback and unix-socket URLs alone", () => {
    for (const url of [
      "postgresql://postgres@127.0.0.1:5433/smilenotes",
      "postgresql://postgres@localhost:5432/appdb",
      "postgresql://postgres@[::1]:5432/appdb",
      "postgresql:///appdb?host=/var/run/postgresql"
    ]) {
      expect(pinPostgresSslMode(url), url).not.toContain("sslmode=");
    }
  });
});
