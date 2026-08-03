import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { getDb } from "@/lib/db/client";
import { getUserByUsername } from "@/lib/db/repo/users";
import { verifyPassword } from "./password";
import { clearThrottle, IP_FREE_ATTEMPTS, loginIpKey, recordFailure } from "./throttle";
import { clientIp } from "./clientIp";
import { logAction } from "@/lib/db/repo/auditLog";
import { sessionWatermark } from "./sessionWatermark";

// A real (never-matching) hash so unknown-username logins burn the same
// bcrypt time as wrong-password logins — otherwise response latency tells
// an attacker which usernames exist.
const TIMING_DUMMY_HASH = "$2b$12$trtV1CTHstBOdm7lfhVlbOLvcgExqOjspQH8/XiGsdsKahewnGzfS";

// Authentication was the one thing the audit log could not see. Every user
// action was recorded, but not the sign-in that made it possible — so a
// takeover looked identical to a normal day's work.
//
// Never throws: a logging failure must not turn a valid sign-in into a
// rejected one. A missing audit row is a gap; a locked-out clinician mid-shift
// is an outage.
async function logAuth(
  db: Awaited<ReturnType<typeof getDb>>,
  action: string,
  username: string,
  ip: string | null,
  actorId?: string,
  displayName?: string
): Promise<void> {
  try {
    await logAction(db, {
      actorId: actorId ?? null,
      actorName: displayName ? `${displayName} (${username})` : null,
      action,
      target: username,
      // The source address, as reported. clientIp() reads the proxy chain from
      // the right by TRUSTED_PROXY_HOPS, so it is as trustworthy as the
      // deployment's proxy config and no more — treat it as a lead, not proof.
      detail: ip ? `from ${ip}` : null
    });
  } catch {
    // Intentionally swallowed. See above.
  }
}

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
          if (gate.locked) {
            // Worth a log row: this is the shape a credential-stuffing run
            // makes. Bounded by the throttle itself — once locked, the source
            // is refused, so it cannot write these in a loop.
            await logAuth(db, "auth.lockout", username, ip);
            return null; // over budget → no bcrypt
          }
        }

        // New accounts are stored lowercase; the exact-match fallback keeps
        // any pre-normalization account working.
        const user =
          (await getUserByUsername(db, username)) ??
          (await getUserByUsername(db, username.toLowerCase()));
        if (!user || !user.active) {
          await verifyPassword(password, TIMING_DUMMY_HASH); // equalize timing
          // Deliberately NOT logged. An unknown username is unbounded input, so
          // logging it would let anyone write arbitrary rows into the audit log
          // — and the log would then double as a list of guessed usernames.
          return null; // the attempt was already reserved above
        }
        if (!(await verifyPassword(password, user.passHash))) {
          // A real account with a wrong password IS worth recording: it is the
          // signal a practice manager needs to see. Bounded by the IP throttle.
          await logAuth(db, "auth.failed", user.username, ip, user.id, user.displayName);
          return null; // already reserved
        }
        if (ipKey) await clearThrottle(db, ipKey);
        await logAuth(db, "auth.signin", user.username, ip, user.id, user.displayName);
        return {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
          noticeAcked: user.noticeAckAt !== null,
          // Watermark this token against the account's CURRENT revocation
          // stamp. It must be the same rule the guards check with, or a token
          // could be born already dead — see sessionWatermark.ts.
          pwAt: sessionWatermark(user)
        };
      }
    })
  ]
});
