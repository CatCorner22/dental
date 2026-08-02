import { describe, expect, it } from "vitest";
import { emailPolicyError, isValidEmail, resetDestination, sameEmail } from "./emails";

describe("isValidEmail", () => {
  it("accepts ordinary practice addresses", () => {
    for (const e of ["a@b.co", "front.desk@smile-dental.com", "dr.o'neil@clinic.co.uk"]) {
      expect(isValidEmail(e), e).toBe(true);
    }
  });

  it("rejects junk and typos", () => {
    for (const e of ["", "   ", "nope", "a@b", "a b@c.com", "a@@b.com", "a@b..", "<a@b.co>"]) {
      expect(isValidEmail(e), JSON.stringify(e)).toBe(false);
    }
  });

  it("rejects an absurdly long address", () => {
    expect(isValidEmail("a".repeat(250) + "@b.com")).toBe(false);
  });
});

describe("emailPolicyError", () => {
  it("lets ordinary roles have no email at all", () => {
    for (const r of ["readonly", "user", "lead", "admin"] as const) {
      expect(emailPolicyError(r, { email: null, groupEmail: null }), r).toBeNull();
    }
  });

  it("still validates an email that IS given", () => {
    expect(emailPolicyError("user", { email: "nope", groupEmail: null })).toContain("valid email");
  });

  // The rule you specified: a Hierarchy Manager is an escalation path, so it
  // must not be one personal mailbox that can go unread.
  it("requires a Hierarchy Manager to carry both addresses", () => {
    expect(emailPolicyError("manager", { email: null, groupEmail: null })).toContain("personal email");
    expect(emailPolicyError("manager", { email: "boss@x.com", groupEmail: null })).toContain(
      "management group email"
    );
    expect(
      emailPolicyError("manager", { email: "boss@x.com", groupEmail: "mgmt@x.com" })
    ).toBeNull();
  });

  it("refuses a group address that is really the same mailbox", () => {
    expect(
      emailPolicyError("manager", { email: "boss@x.com", groupEmail: "BOSS@X.com" })
    ).toContain("different");
  });

  it("compares addresses case-insensitively", () => {
    expect(sameEmail(" Boss@X.com ", "boss@x.com")).toBe(true);
    expect(sameEmail("a@x.com", "b@x.com")).toBe(false);
  });
});

describe("resetDestination", () => {
  it("sends to the personal address, never the group one", () => {
    expect(resetDestination({ email: "me@x.com", groupEmail: "mgmt@x.com" })).toBe("me@x.com");
    // A reset link is a credential for ONE person; mailing it to a shared
    // management inbox would hand the account to everyone on that list.
    expect(resetDestination({ email: null, groupEmail: "mgmt@x.com" })).toBeNull();
  });

  it("refuses an invalid stored address rather than trying to send", () => {
    expect(resetDestination({ email: "broken", groupEmail: null })).toBeNull();
  });
});
