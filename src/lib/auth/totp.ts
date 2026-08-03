import { Secret, TOTP } from "otpauth";
import { APP_NAME } from "@/lib/brand";

// TOTP (RFC 6238) for the second factor. Standard parameters — SHA-1, six
// digits, thirty-second period — because those are what every authenticator
// app implements; a "stronger" nonstandard choice here would just mean codes
// that never match.
//
// The verification window is ±1 period: a code typed in the last second of
// its life still works, and clock skew of up to thirty seconds on a phone
// does not lock its owner out. Wider than that stops being a time-based
// factor.

const PERIOD = 30;
const DIGITS = 6;

export function generateMfaSecret(): string {
  return new Secret({ size: 20 }).base32;
}

function totpFor(username: string, secretBase32: string): TOTP {
  return new TOTP({
    issuer: APP_NAME,
    label: username,
    algorithm: "SHA1",
    digits: DIGITS,
    period: PERIOD,
    secret: Secret.fromBase32(secretBase32)
  });
}

/** The otpauth:// URI an authenticator app enrolls from (shown once, at setup). */
export function mfaEnrollmentUri(username: string, secretBase32: string): string {
  return totpFor(username, secretBase32).toString();
}

export function verifyMfaCode(
  username: string,
  secretBase32: string,
  code: string,
  now: number = Date.now()
): boolean {
  const cleaned = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleaned)) return false;
  try {
    const delta = totpFor(username, secretBase32).validate({ token: cleaned, timestamp: now, window: 1 });
    return delta !== null;
  } catch {
    return false;
  }
}

/** For the enrollment screen: generate the current code server-side never — this exists for tests only. */
export function currentCodeForTest(username: string, secretBase32: string, now: number): string {
  return totpFor(username, secretBase32).generate({ timestamp: now });
}
