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

  it("leaves verify-full and urls without sslmode alone", () => {
    const full = "postgres://h/db?sslmode=verify-full";
    expect(pinPostgresSslMode(full)).toBe(full);
    const bare = "postgres://h/db";
    expect(pinPostgresSslMode(bare)).toBe(bare);
  });

  it("preserves sibling query params", () => {
    const inUrl = "postgres://h/db?channel_binding=require&sslmode=require&foo=1";
    expect(pinPostgresSslMode(inUrl)).toBe(
      "postgres://h/db?channel_binding=require&sslmode=verify-full&foo=1"
    );
  });
});
