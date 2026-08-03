import { describe, expect, it } from "vitest";
import { clientIp, TRUSTED_PROXY_HOPS } from "./clientIp";

const req = (headers: Record<string, string>) => new Request("http://x/login", { headers });

describe("clientIp", () => {
  it("returns null with no proxy headers (throttle skipped, not shared)", () => {
    expect(clientIp(req({}))).toBeNull();
    expect(clientIp(undefined)).toBeNull();
  });

  it("prefers the forge-proof platform header over x-forwarded-for", () => {
    expect(
      clientIp(req({ "x-vercel-forwarded-for": "9.9.9.9", "x-forwarded-for": "1.1.1.1" }))
    ).toBe("9.9.9.9");
    expect(clientIp(req({ "x-real-ip": "9.9.9.9", "x-forwarded-for": "1.1.1.1" }))).toBe("9.9.9.9");
  });

  // The whole point of the fix: a client that PREPENDS a forged entry to
  // x-forwarded-for must not be believed. With one trusted proxy the real
  // client is the RIGHTMOST entry (the one the proxy appended).
  it("reads x-forwarded-for from the right, ignoring a spoofed leftmost entry", () => {
    expect(TRUSTED_PROXY_HOPS).toBe(1);
    // Attacker sends "X-Forwarded-For: 6.6.6.6"; the proxy appends the real client.
    expect(clientIp(req({ "x-forwarded-for": "6.6.6.6, 203.0.113.5" }))).toBe("203.0.113.5");
    // A single honest entry is returned as-is.
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.5" }))).toBe("203.0.113.5");
  });

  it("two different spoofed leftmosts still map to the SAME real client key", () => {
    // This is what stops throttle-evasion by rotating the forged entry.
    const a = clientIp(req({ "x-forwarded-for": "1.1.1.1, 203.0.113.5" }));
    const b = clientIp(req({ "x-forwarded-for": "2.2.2.2, 203.0.113.5" }));
    expect(a).toBe(b);
    expect(a).toBe("203.0.113.5");
  });

  // Whatever comes back becomes a throttle key, and that table is pruned on the
  // same path that grows it. A header carrying arbitrary text is a way to spray
  // unbounded distinct keys, and to park attacker-chosen strings somewhere they
  // will later be rendered on a page. Not an address → not believed.
  it("ignores header values that are not shaped like an address", () => {
    expect(clientIp(req({ "x-real-ip": "not-an-ip" }))).toBeNull();
    expect(clientIp(req({ "x-real-ip": "<script>alert(1)</script>" }))).toBeNull();
    expect(clientIp(req({ "x-real-ip": "a".repeat(5000) }))).toBeNull();
    expect(clientIp(req({ "x-forwarded-for": "junk, also-junk" }))).toBeNull();
  });

  it("falls through to a header it can trust rather than failing closed", () => {
    // A junk x-real-ip must not shadow a usable x-forwarded-for.
    expect(clientIp(req({ "x-real-ip": "nonsense", "x-forwarded-for": "203.0.113.7" }))).toBe(
      "203.0.113.7"
    );
  });

  it("accepts IPv6", () => {
    expect(clientIp(req({ "x-real-ip": "2001:db8::1" }))).toBe("2001:db8::1");
    expect(clientIp(req({ "x-real-ip": "::1" }))).toBe("::1");
  });
});
