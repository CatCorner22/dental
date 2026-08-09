// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() })
}));

import { UserAdmin } from "./UserAdmin";

// The lost-device affordance. MfaSettings promises "a Smile Notes Developer
// can reset MFA for your account"; before this existed the only way to keep
// that promise was curl. The rules pinned here mirror the route exactly:
// Developer only, never self, only when a factor is actually armed, and only
// while the deployment offers MFA at all — a button outside those bounds
// could only ever 403.
const row = (over: Record<string, unknown> = {}) => ({
  id: "u-target",
  username: "dana",
  displayName: "Dana",
  role: "user" as const,
  active: true,
  officeIds: [],
  clinicalRole: "unset" as const,
  mfaArmed: true,
  ...over
});
const self = (role: "admin" | "manager") => ({
  selfId: "u-self",
  selfRole: role,
  offices: [],
  mfaFeatureOn: true
});

describe("UserAdmin — Reset MFA affordance", () => {
  it("shows for a Developer on an armed account", () => {
    render(<UserAdmin {...self("admin")} users={[row()]} />);
    expect(screen.getAllByRole("button", { name: "Reset MFA" }).length).toBeGreaterThan(0);
  });

  it("never shows to a Hierarchy Manager", () => {
    render(<UserAdmin {...self("manager")} users={[row()]} />);
    expect(screen.queryByRole("button", { name: "Reset MFA" })).toBeNull();
  });

  it("never shows on the Developer's own row — self-reset stays code-gated", () => {
    render(<UserAdmin {...self("admin")} users={[row({ id: "u-self", role: "admin" })]} />);
    expect(screen.queryByRole("button", { name: "Reset MFA" })).toBeNull();
  });

  it("never shows when the account holds no factor", () => {
    render(<UserAdmin {...self("admin")} users={[row({ mfaArmed: false })]} />);
    expect(screen.queryByRole("button", { name: "Reset MFA" })).toBeNull();
  });

  it("never shows while the deployment has MFA off", () => {
    render(<UserAdmin {...self("admin")} mfaFeatureOn={false} users={[row()]} />);
    expect(screen.queryByRole("button", { name: "Reset MFA" })).toBeNull();
  });
});
