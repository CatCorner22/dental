import { describe, expect, it } from "vitest";
import {
  ROLE_LABEL,
  ROLE_RANK,
  canAddUser,
  canAssignRole,
  canDeactivateOrDelete,
  canManageUsers,
  canMergeUsers,
  canReadAuditLog,
  canSendResetLink,
  canSetPasswordDirectly,
  canSubmitChangeRequest,
  canTransferNotes,
  canWriteNote,
  meetsRole,
  requiresTwoEmails,
  seesAllNotes,
  type Role
} from "./roles";

const ALL: Role[] = ["readonly", "user", "lead", "manager", "admin"];

describe("role ladder", () => {
  it("ranks the hierarchy in order", () => {
    expect(ROLE_RANK.readonly).toBeLessThan(ROLE_RANK.user);
    expect(ROLE_RANK.user).toBeLessThan(ROLE_RANK.lead);
    expect(ROLE_RANK.lead).toBeLessThan(ROLE_RANK.manager);
    expect(ROLE_RANK.manager).toBeLessThan(ROLE_RANK.admin);
  });

  it("labels every role, including the renamed developer", () => {
    for (const r of ALL) expect(ROLE_LABEL[r]).toBeTruthy();
    expect(ROLE_LABEL.lead).toBe("Team Lead");
    expect(ROLE_LABEL.manager).toBe("Hierarchy Manager");
    expect(ROLE_LABEL.admin).toBe("Smile Notes Developer");
  });

  it("meetsRole is inclusive and monotonic", () => {
    expect(meetsRole("lead", "user")).toBe(true);
    expect(meetsRole("lead", "lead")).toBe(true);
    expect(meetsRole("lead", "manager")).toBe(false);
    expect(meetsRole("manager", "lead")).toBe(true);
    expect(meetsRole(undefined, "readonly")).toBe(false);
  });
});

describe("note capabilities", () => {
  it("scopes only a plain user to their own notes", () => {
    expect(seesAllNotes("user")).toBe(false);
    for (const r of ["readonly", "lead", "manager", "admin"] as Role[]) {
      expect(seesAllNotes(r), r).toBe(true);
    }
  });

  // The bug this replaced: canWrite was `role === "admin" || role === "user"`,
  // so a Team Lead matched neither branch and could not edit their OWN note.
  it("lets every writing role edit their own note", () => {
    for (const r of ["user", "lead", "manager", "admin"] as Role[]) {
      expect(canWriteNote(r, "me", "me"), r).toBe(true);
    }
    expect(canWriteNote("readonly", "me", "me")).toBe(false);
  });

  it("lets only the developer edit someone else's clinical note", () => {
    expect(canWriteNote("admin", "them", "me")).toBe(true);
    for (const r of ["readonly", "user", "lead", "manager"] as Role[]) {
      expect(canWriteNote(r, "them", "me"), r).toBe(false);
    }
  });

  it("makes transfer a lead-and-above power", () => {
    expect(canTransferNotes("user")).toBe(false);
    expect(canTransferNotes("lead")).toBe(true);
    expect(canTransferNotes("manager")).toBe(true);
  });
});

describe("user-management capabilities", () => {
  it("nobody below Team Lead manages users", () => {
    for (const r of ["readonly", "user"] as Role[]) {
      expect(canManageUsers(r), r).toBe(false);
      for (const t of ALL) {
        expect(canAddUser(r, t), `${r}->${t}`).toBe(false);
        expect(canMergeUsers(r, t), `${r}->${t}`).toBe(false);
        expect(canSendResetLink(r, t), `${r}->${t}`).toBe(false);
      }
    }
  });

  it("a Team Lead acts only on accounts below them", () => {
    expect(canAddUser("lead", "readonly")).toBe(true);
    expect(canAddUser("lead", "user")).toBe(true);
    // Never a peer or above — this is the escalation guard.
    for (const t of ["lead", "manager", "admin"] as Role[]) {
      expect(canAddUser("lead", t), t).toBe(false);
      expect(canMergeUsers("lead", t), t).toBe(false);
      expect(canSendResetLink("lead", t), t).toBe(false);
      expect(canDeactivateOrDelete("lead", t), t).toBe(false);
    }
  });

  // The literal constraint: top of the practice, yet may ONLY mint Team Leads.
  it("a Hierarchy Manager may only ever create Team Leads", () => {
    expect(canAddUser("manager", "lead")).toBe(true);
    for (const t of ["readonly", "user", "manager", "admin"] as Role[]) {
      expect(canAddUser("manager", t), t).toBe(false);
    }
  });

  it("a Hierarchy Manager may act on Team Leads and below, never a developer", () => {
    for (const t of ["readonly", "user", "lead"] as Role[]) {
      expect(canMergeUsers("manager", t), t).toBe(true);
      expect(canSendResetLink("manager", t), t).toBe(true);
    }
    expect(canMergeUsers("manager", "manager")).toBe(false);
    expect(canMergeUsers("manager", "admin")).toBe(false);
    expect(canSendResetLink("manager", "admin")).toBe(false);
  });

  it("only a Hierarchy Manager or Developer changes roles, and a manager only to Team Lead", () => {
    expect(canAssignRole("lead", "user", "lead")).toBe(false);
    expect(canAssignRole("manager", "user", "lead")).toBe(true);
    expect(canAssignRole("manager", "user", "manager")).toBe(false);
    expect(canAssignRole("manager", "user", "admin")).toBe(false);
    // Cannot promote someone already above the manager's ceiling.
    expect(canAssignRole("manager", "admin", "lead")).toBe(false);
    expect(canAssignRole("admin", "user", "admin")).toBe(true);
  });

  // The heart of "reset by link but never see a password".
  it("only the developer may set a password directly", () => {
    expect(canSetPasswordDirectly("admin")).toBe(true);
    for (const r of ["readonly", "user", "lead", "manager"] as Role[]) {
      expect(canSetPasswordDirectly(r), r).toBe(false);
    }
  });

  it("a developer may act on anyone", () => {
    for (const t of ALL) {
      expect(canAddUser("admin", t), t).toBe(true);
      expect(canMergeUsers("admin", t), t).toBe(true);
      expect(canSendResetLink("admin", t), t).toBe(true);
    }
  });
});

describe("other capabilities", () => {
  it("restricts the audit log to manager and above", () => {
    for (const r of ["readonly", "user", "lead"] as Role[]) {
      expect(canReadAuditLog(r), r).toBe(false);
    }
    expect(canReadAuditLog("manager")).toBe(true);
    expect(canReadAuditLog("admin")).toBe(true);
  });

  it("opens Gauntlet tickets to lead and above", () => {
    expect(canSubmitChangeRequest("user")).toBe(false);
    expect(canSubmitChangeRequest("lead")).toBe(true);
    expect(canSubmitChangeRequest("manager")).toBe(true);
  });

  it("requires two emails only for a Hierarchy Manager", () => {
    expect(requiresTwoEmails("manager")).toBe(true);
    for (const r of ["readonly", "user", "lead", "admin"] as Role[]) {
      expect(requiresTwoEmails(r), r).toBe(false);
    }
  });
});
