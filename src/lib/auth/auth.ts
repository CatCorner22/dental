import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { getDb } from "@/lib/db/client";
import { getUserByUsername } from "@/lib/db/repo/users";
import { verifyPassword } from "./password";
import { clearThrottle, IP_FREE_ATTEMPTS, loginIpKey, recordFailure } from "./throttle";
import { clientIp } from "./clientIp";

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

        // Throttle login by IP, and RESERVE before spending bcrypt.
        //
        // The gate stops one source from burning our cost-12 bcrypt CPU in a
        // loop. It is keyed by IP, not username: a username-keyed gate let an
        // attacker vary the username for a fresh budget every request (unbounded
        // CPU) and, checked before the password, let anyone who knew a username
        // hold the real owner out. Keying on IP bounds a source's total spend
        // across every username and never traps a user signing in from a clean
        // address — the correct password always works. The deliberate trade is
        // that hard per-account lockout, a DoS foot-gun, is gone.
        //
        // The failure is recorded (reserved) BEFORE bcrypt, and the attempt
        // proceeds only if that reservation is still within budget. A plain
        // check-then-hash gate lets a concurrent burst all pass the check and
        // fire N hashes at once; reserving first means the atomic counter is
        // already rising when the burst races, so over-budget attempts are
        // refused before any hash. A correct password clears the whole streak
        // at the end, so a legitimate user's reservations never accumulate.
        const ip = clientIp(request as Request | undefined);
        const ipKey = ip ? loginIpKey(ip) : null;
        if (ipKey) {
          const gate = await recordFailure(db, ipKey, now, IP_FREE_ATTEMPTS);
          if (gate.locked) return null; // over budget → no bcrypt
        }

        // New accounts are stored lowercase; the exact-match fallback keeps
        // any pre-normalization account working.
        const user =
          (await getUserByUsername(db, username)) ??
          (await getUserByUsername(db, username.toLowerCase()));
        if (!user || !user.active) {
          await verifyPassword(password, TIMING_DUMMY_HASH); // equalize timing
          return null; // the attempt was already reserved above
        }
        if (!(await verifyPassword(password, user.passHash))) {
          return null; // already reserved
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
