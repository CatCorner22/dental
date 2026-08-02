import { describe, expect, it } from "vitest";
import {
  APP_NAME,
  COPYRIGHT,
  COPYRIGHT_HOLDER,
  COPYRIGHT_YEAR,
  PRIVACY_POLICY,
  pageTitle
} from "./brand";

// These two strings were specified verbatim by the owner. They are a legal
// assertion, not copy to be improved — so they are pinned here. If someone
// "tidies" the wording, this test is the thing that objects.
describe("legal notices", () => {
  it("states the copyright exactly as specified", () => {
    expect(COPYRIGHT).toBe("© Copyright 2026 Blake Reagan, all rights reserved.");
    expect(COPYRIGHT_HOLDER).toBe("Blake Reagan");
    expect(COPYRIGHT_YEAR).toBe(2026);
  });

  it("states the privacy policy exactly as specified", () => {
    expect(PRIVACY_POLICY).toBe(
      "Privacy Policy: by using this software platform, you agree that you will not input PII " +
        "or other legally sensitive information into Smile Notes."
    );
  });

  // The policy names the product. A rename that misses this string leaves a
  // legal notice pointing at software that no longer exists.
  it("names the product inside the policy text", () => {
    expect(PRIVACY_POLICY).toContain(APP_NAME);
  });
});

describe("page titles", () => {
  it("suffixes a page name and stands alone without one", () => {
    expect(pageTitle("History")).toBe("History — Smile Notes");
    expect(pageTitle()).toBe("Smile Notes");
  });

  // The root layout sets a `%s — Smile Notes` template, so any child page that
  // still carries its own suffix renders "History — Smile Notes — Smile Notes".
  it("never double-suffixes", () => {
    expect(pageTitle("History").match(/Smile Notes/g)).toHaveLength(1);
  });
});
