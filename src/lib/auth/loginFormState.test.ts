import { describe, expect, it } from "vitest";

import { loginFailureMessage, sanitizeCallbackPath } from "./loginFormState";

// The sanitizer stands between an attacker-crafted ?callbackUrl= and where a
// fresh session gets redirected. Its contract: same-origin path or "/",
// nothing else, no exceptions.
describe("sanitizeCallbackPath", () => {
  it("keeps an ordinary same-origin path with its query", () => {
    expect(sanitizeCallbackPath("/notes?tab=filed")).toBe("/notes?tab=filed");
    expect(sanitizeCallbackPath("/admin/audit")).toBe("/admin/audit");
    expect(sanitizeCallbackPath("/")).toBe("/");
  });

  it("drops a fragment rather than reflecting it", () => {
    expect(sanitizeCallbackPath("/notes#x")).toBe("/notes");
  });

  it("reduces the absolute URL next-auth actually sends to its path", () => {
    // THE case whose absence shipped a regression: the authorized-callback
    // bounce sets callbackUrl to request.nextUrl.href — absolute — and the
    // first version of the sanitizer refused it, sending every bounced deep
    // link to the home page after sign-in.
    expect(sanitizeCallbackPath("https://smile.example.com/notes?tab=filed")).toBe(
      "/notes?tab=filed"
    );
    expect(sanitizeCallbackPath("http://127.0.0.1:3100/digest")).toBe("/digest");
  });

  it("strips a foreign origin to a harmless local path", () => {
    // Same-origin by construction: whatever host a crafted link names, only
    // the path survives, and a path on our own origin is not a redirect
    // anywhere.
    expect(sanitizeCallbackPath("http://evil.com/phish")).toBe("/phish");
    expect(sanitizeCallbackPath("https://evil.com")).toBe("/");
  });

  it("refuses protocol-relative escapes", () => {
    // "//evil.org" is the one shape that survives a pathname+search
    // reduction and still leaves the origin.
    expect(sanitizeCallbackPath("//evil.org")).toBe("/");
    expect(sanitizeCallbackPath("//evil.org/phish")).toBe("/");
  });

  it("refuses non-http schemes outright", () => {
    expect(sanitizeCallbackPath("javascript:alert(1)")).toBe("/");
    expect(sanitizeCallbackPath("data:text/html,hi")).toBe("/");
  });

  it("falls back to home on garbage and absence", () => {
    expect(sanitizeCallbackPath(undefined)).toBe("/");
    expect(sanitizeCallbackPath(null)).toBe("/");
    expect(sanitizeCallbackPath("")).toBe("/");
    expect(sanitizeCallbackPath("notes")).toBe("/");
    expect(sanitizeCallbackPath("\\\\evil")).toBe("/");
  });
});

// The message branches are a security surface as much as copy: every server
// failure is deliberately indistinguishable, so the words may vary only on
// what the deployment supports and what the form already offered — never on
// what actually went wrong.
describe("loginFailureMessage", () => {
  it("without MFA on the deployment, says username and password only", () => {
    expect(loginFailureMessage(false, false, 1)).toBe(
      "Sign-in failed. Check the username and password."
    );
  });

  it("with MFA available but not yet offered, offers the code field", () => {
    expect(loginFailureMessage(true, false, 1)).toBe(
      "Sign-in failed. If this account uses an authenticator app, enter the current code below."
    );
  });

  it("once the code field was offered, includes it in the checklist", () => {
    expect(loginFailureMessage(true, true, 1)).toBe(
      "Sign-in failed. Check the username, password, and authenticator code."
    );
  });

  it("adds the throttle hint from the third attempt", () => {
    expect(loginFailureMessage(true, true, 2)).not.toMatch(/briefly paused/);
    expect(loginFailureMessage(true, true, 3)).toMatch(/briefly paused/);
    expect(loginFailureMessage(false, false, 5)).toMatch(/briefly paused/);
  });
});
