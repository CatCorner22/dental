import { describe, expect, it } from "vitest";
import { isTokenRevoked, sessionWatermark } from "./sessionWatermark";

const t = (ms: number) => new Date(ms);

describe("sessionWatermark", () => {
  it("is zero for a never-changed, never-revoked account", () => {
    expect(sessionWatermark({ passwordChangedAt: null, sessionsRevokedAt: null })).toBe(0);
  });

  it("takes the LATER of the two events", () => {
    expect(sessionWatermark({ passwordChangedAt: t(100), sessionsRevokedAt: t(200) })).toBe(200);
    expect(sessionWatermark({ passwordChangedAt: t(300), sessionsRevokedAt: t(200) })).toBe(300);
  });

  it("uses whichever one is set when the other is null", () => {
    expect(sessionWatermark({ passwordChangedAt: t(500), sessionsRevokedAt: null })).toBe(500);
    expect(sessionWatermark({ passwordChangedAt: null, sessionsRevokedAt: t(500) })).toBe(500);
  });
});

describe("isTokenRevoked", () => {
  const changed = { passwordChangedAt: t(1000), sessionsRevokedAt: null };

  it("kills a token minted before the watermark", () => {
    expect(isTokenRevoked(changed, 999)).toBe(true);
  });

  // The token issued AT the moment of the change is the NEW one — it must live,
  // or a password change would bounce the very session it just created and the
  // user could never stay signed in.
  it("keeps a token minted at the exact watermark", () => {
    expect(isTokenRevoked(changed, 1000)).toBe(false);
  });

  it("keeps a token minted after the watermark", () => {
    expect(isTokenRevoked(changed, 1001)).toBe(false);
  });

  it("treats a missing token stamp as ancient (revoked)", () => {
    expect(isTokenRevoked(changed, undefined)).toBe(true);
  });

  it("does not revoke when nothing has happened", () => {
    expect(isTokenRevoked({ passwordChangedAt: null, sessionsRevokedAt: null }, 0)).toBe(false);
  });

  // "Sign out all devices" must revoke even when the password never changed —
  // the whole point of the second column.
  it("revokes on a device sign-out with no password change", () => {
    const revoked = { passwordChangedAt: null, sessionsRevokedAt: t(2000) };
    expect(isTokenRevoked(revoked, 1500)).toBe(true);
    expect(isTokenRevoked(revoked, 2500)).toBe(false);
  });
});
