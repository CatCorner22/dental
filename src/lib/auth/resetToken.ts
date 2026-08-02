import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// A reset link is a bearer credential: whoever holds it can take over the
// account. So it is treated like a password, not like an id.
//
//  - 32 random bytes from a CSPRNG (not a UUID, which leaks time/MAC structure
//    and has fewer random bits than its length suggests).
//  - Only the SHA-256 HASH is stored. A leaked database dump must not hand
//    anyone a working link. Hashing is enough here where password hashing needs
//    bcrypt, because the secret is full-entropy random — there is no dictionary
//    to attack, so the slow-hash cost buys nothing.
//  - Short-lived and single-use, enforced at redemption.

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // one hour

export function generateResetToken(): string {
  // base64url so the token survives a URL path segment untouched — no
  // percent-encoding surprises when it is pasted out of an email client.
  return randomBytes(32).toString("base64url");
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

// Constant-time compare for hex digests of equal length. The lookup is by hash
// so this is belt-and-braces, but comparing secrets with === is the kind of
// habit that eventually matters.
export function resetTokenMatches(presented: string, storedHash: string): boolean {
  const a = Buffer.from(hashResetToken(presented), "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

export function resetTokenExpiry(now: Date): Date {
  return new Date(now.getTime() + RESET_TOKEN_TTL_MS);
}

// The link a person clicks. Base URL comes from configuration, never from the
// request — a Host header an attacker controls would otherwise let them mail a
// victim a link that points at their own server and harvests the token.
export function resetLinkUrl(token: string): string {
  const base = (process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "").trim().replace(/\/+$/, "");
  return `${base}/reset/${token}`;
}
