import { describe, expect, it } from "vitest";
import {
  killersBlockHandoff,
  copyExportLocked,
  submitHandoffBlocked,
  writingEnabled
} from "./handoffGates";

describe("killersBlockHandoff", () => {
  it("blocks when any litigation killer is open", () => {
    expect(killersBlockHandoff(1)).toBe(true);
    expect(killersBlockHandoff(3)).toBe(true);
  });

  it("does not block when the killer set is empty (Soft S2 non-killers may remain)", () => {
    expect(killersBlockHandoff(0)).toBe(false);
  });
});

describe("copyExportLocked — builder finish composition", () => {
  const open = {
    hasContent: true,
    exportAllowed: true,
    roleRecorded: true,
    dentistMustOwnKillers: false,
    filingAllowed: true,
    killersBlock: false
  };

  it("is open only when every gate clears", () => {
    expect(copyExportLocked(open)).toBe(false);
  });

  it.each([
    ["empty note", { hasContent: false }],
    ["audit export blocked", { exportAllowed: false }],
    ["unset role", { roleRecorded: false }],
    ["dentist must own killers", { dentistMustOwnKillers: true }],
    ["filing denied", { filingAllowed: false }],
    ["killers open", { killersBlock: true }]
  ] as const)("locks for %s", (_label, over) => {
    expect(copyExportLocked({ ...open, ...over })).toBe(true);
  });
});

describe("submitHandoffBlocked", () => {
  const open = {
    hasContent: true,
    emailAllowed: true,
    filingAllowed: true,
    roleRecorded: true,
    killersBlock: false,
    alreadySubmitted: false
  };

  it("is open only when every gate clears", () => {
    expect(submitHandoffBlocked(open)).toBe(false);
  });

  it("locks on killers even when Soft S2 would not flip emailAllowed", () => {
    expect(submitHandoffBlocked({ ...open, killersBlock: true })).toBe(true);
  });

  it("locks after submit", () => {
    expect(submitHandoffBlocked({ ...open, alreadySubmitted: true })).toBe(true);
  });
});

describe("writingEnabled — role-before-work", () => {
  it("requires both canEdit and a recorded role", () => {
    expect(writingEnabled(true, true)).toBe(true);
    expect(writingEnabled(true, false)).toBe(false);
    expect(writingEnabled(false, true)).toBe(false);
  });
});
