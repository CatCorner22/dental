import { describe, expect, it } from "vitest";
import { ROLE_RANK, meetsRole } from "./roles";

describe("role ranking", () => {
  it("orders readonly < user < admin", () => {
    expect(ROLE_RANK.readonly).toBeLessThan(ROLE_RANK.user);
    expect(ROLE_RANK.user).toBeLessThan(ROLE_RANK.admin);
  });

  it("meetsRole checks the minimum inclusively", () => {
    expect(meetsRole("admin", "user")).toBe(true);
    expect(meetsRole("user", "user")).toBe(true);
    expect(meetsRole("readonly", "user")).toBe(false);
    expect(meetsRole("user", "admin")).toBe(false);
    expect(meetsRole("readonly", "readonly")).toBe(true);
    expect(meetsRole(undefined, "readonly")).toBe(false);
  });
});
