import { describe, expect, it } from "vitest";

import { FEEDBACK_CONFIGURED, FEEDBACK_EMAIL, feedbackMailto } from "./feedback";

// This module shipped a hardcoded personal address that the footer rendered on
// every page of a clinical tool. The contract now: the address is a deployment
// fact, and an unconfigured build offers no feedback route at all rather than
// pointing staff — and the clinical context in their replies — at an inbox
// nobody chose. Vitest runs with NEXT_PUBLIC_FEEDBACK_EMAIL unset, so this
// file pins the unconfigured half; ci.yml sets it for the cross-browser smoke,
// which pins the configured half against a real browser.
describe("feedback address", () => {
  it("ships no default address", () => {
    expect(FEEDBACK_EMAIL).toBe("");
    expect(FEEDBACK_CONFIGURED).toBe(false);
  });

  it("offers no mailto when unconfigured, so no dead compose window", () => {
    expect(feedbackMailto()).toBeNull();
    expect(feedbackMailto("Anything")).toBeNull();
  });

  it("never names a personal mailbox in source", () => {
    // The specific address that shipped; a regression would reintroduce it.
    expect(FEEDBACK_EMAIL).not.toMatch(/protonmail/i);
  });
});
