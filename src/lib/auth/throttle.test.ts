import { describe, expect, it } from "vitest";
import { FREE_ATTEMPTS, MAX_LOCK_MS, lockMsFor, loginKey, passwordCheckKey } from "./throttle";

describe("lockMsFor", () => {
  it("costs nothing for the first few attempts", () => {
    for (let n = 0; n <= FREE_ATTEMPTS; n++) {
      expect(lockMsFor(n), `attempt ${n}`).toBe(0);
    }
  });

  it("starts small so a typo is not a punishment", () => {
    expect(lockMsFor(FREE_ATTEMPTS + 1)).toBe(15_000);
  });

  it("doubles with each further failure", () => {
    expect(lockMsFor(FREE_ATTEMPTS + 2)).toBe(30_000);
    expect(lockMsFor(FREE_ATTEMPTS + 3)).toBe(60_000);
  });

  // The cap matters: without it the backoff would run to hours and a
  // legitimate user locked out by someone else's guessing would be stuck.
  it("caps out rather than growing without bound", () => {
    expect(lockMsFor(FREE_ATTEMPTS + 20)).toBe(MAX_LOCK_MS);
    expect(lockMsFor(10_000)).toBe(MAX_LOCK_MS);
  });

  it("namespaces keys so login and password-check throttles never collide", () => {
    expect(loginKey("Ann")).toBe("login:ann");
    expect(passwordCheckKey("u1")).toBe("pwcheck:u1");
    expect(loginKey("u1")).not.toBe(passwordCheckKey("u1"));
  });
});
