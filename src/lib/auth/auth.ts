import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { getDb } from "@/lib/db/client";
import { getUserByUsername } from "@/lib/db/repo/users";
import { verifyPassword } from "./password";
import { checkThrottle, clearThrottle, IP_FREE_ATTEMPTS, loginIpKey, recordFailure } from "./throttle";

// The client IP for throttling. On Vercel and behind the agent proxy the real
// client is the first entry of x-forwarded-for; x-real-ip is the fallback.
// Returns null when no header is present (e.g. a direct local request), in
// which case the IP throttle is simply skipped rather than lumping every
// caller under one shared key that could lock the whole world out at once.
function clientIp(req: Request | undefined): string | null {
  const xff = req?.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req?.headers.get("x-real-ip")?.trim();
  return real || null;
}

// A real (never-matching) hash so unknown-username logins burn the same
// bcrypt time as wrong-password logins — otherwise response latency tells
// an attacker which usernames exist.
const TIMING_DUMMY_HASH = "$2b$12$trtV1CTHstBOdm7lfhVlbOLvcgExqOjspQH8/XiGsdsKahewnGzfS";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { username: {}, password: {} },
      async authorize(creds, request) {
        const username = typeof creds?.username === "string" ? creds.username.trim() : "";
        const password = typeof creds?.password === "string" ? creds.password : "";
        if (!username || !password) return null;
        const db = await getDb();
        const now = new Date();

        // Throttle BEFORE bcrypt, keyed by IP rather than by username.
        //
        // The point of the gate is to stop one source from spending our cost-12
        // bcrypt CPU in a loop. A username-keyed gate failed at that twice
        // over: an attacker could vary the username to get a fresh budget every
        // request (unbounded CPU), and — because the check ran before the
        // password was verified — anyone who knew a username could hold the
        // real owner out of their account indefinitely. Keying on IP bounds a
        // source's total bcrypt spend across every username, and can never trap
        // a legitimate user who signs in from a different address: from a clean
        // IP the correct password ALWAYS works. Per-account brute force is
        // still bounded (an attacker's IP locks after IP_FREE_ATTEMPTS); the
        // deliberate trade is that hard per-account lockout — a denial-of-
        // service foot-gun — is gone.
        const ip = clientIp(request as Request | undefined);
        const ipKey = ip ? loginIpKey(ip) : null;
        if (ipKey && (await checkThrottle(db, ipKey, now)).locked) return null;

        // New accounts are stored lowercase; the exact-match fallback keeps
        // any pre-normalization account working.
        const user =
          (await getUserByUsername(db, username)) ??
          (await getUserByUsername(db, username.toLowerCase()));
        if (!user || !user.active) {
          await verifyPassword(password, TIMING_DUMMY_HASH); // equalize timing
          if (ipKey) await recordFailure(db, ipKey, now, IP_FREE_ATTEMPTS);
          return null;
        }
        if (!(await verifyPassword(password, user.passHash))) {
          if (ipKey) await recordFailure(db, ipKey, now, IP_FREE_ATTEMPTS);
          return null;
        }
        if (ipKey) await clearThrottle(db, ipKey);
        return {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
          noticeAcked: user.noticeAckAt !== null,
          // Watermark this token against the password it was minted with, so
          // a later change/reset revokes it on the very next request.
          pwAt: user.passwordChangedAt?.getTime() ?? 0
        };
      }
    })
  ]
});
