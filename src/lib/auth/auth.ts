import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { getDb } from "@/lib/db/client";
import { getUserByUsername } from "@/lib/db/repo/users";
import { verifyPassword } from "./password";
import {
  checkThrottle,
  clearThrottle,
  FREE_ATTEMPTS,
  IP_FREE_ATTEMPTS,
  IP_MAX_LOCK_MS,
  loginIpKey,
  loginPairKey,
  recordFailure
} from "./throttle";
import { clientIp } from "./clientIp";
import { withHashSlot } from "./hashGate";
import { logAction } from "@/lib/db/repo/auditLog";
import { sessionWatermark } from "./sessionWatermark";
import { verifyMfaCode } from "./totp";

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
      credentials: { username: {}, password: {}, totp: {} },
      async authorize(creds, request) {
        const username = typeof creds?.username === "string" ? creds.username.trim() : "";
        const password = typeof creds?.password === "string" ? creds.password : "";
        const totpCode = typeof creds?.totp === "string" ? creds.totp.trim() : "";
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
        // Keyed on the PAIR, and CHECKED read-only rather than reserved.
        //
        // Both halves of that sentence are corrections of a design that a live
        // probe proved broken, and they fix two different things.
        //
        // THE KEY. Throttling on the address alone meant one budget for an
        // entire dental practice behind one NAT address, so a stranger
        // hammering the login form refused every clinician in the building. The
        // pair scopes an attacker's damage to the one username they are
        // grinding on. See loginPairKey.
        //
        // THE CHECK. This used to call recordFailure — a WRITE — as the gate,
        // before the password was ever examined. That made the refusal
        // unconditional: an attempt carrying the CORRECT password still
        // incremented the streak, still re-armed the lock, and was still
        // refused. Every expiry was immediately re-locked by the next attempt,
        // so the only way out was fifteen minutes of total silence, which an
        // attacker simply never allows. Measured on a running server: after 70
        // seconds of uninterrupted guessing the right password was still
        // rejected. The old comment here claimed "the correct password always
        // works"; it did not.
        //
        // Reading the lock instead means a lapsed lock genuinely lets one
        // attempt through to be verified, and a correct one clears the streak
        // outright. The burst protection that reserving used to provide now
        // comes from hashGate below, which bounds concurrent bcrypt on a key
        // nobody can forge — a strictly better instrument for that job.
        const pairKey = ip ? loginPairKey(ip, username) : null;
        if (pairKey) {
          const gate = await checkThrottle(db, pairKey, now);
          if (gate.locked) return null; // no write, so a refusal costs an attacker more than us
        }

        // New accounts are stored lowercase; the exact-match fallback keeps
        // any pre-normalization account working.
        const user =
          (await getUserByUsername(db, username)) ??
          (await getUserByUsername(db, username.toLowerCase()));

        // The pair budget is only as honest as the header it is keyed on. This
        // gate is not: it caps concurrent bcrypt process-wide, so a caller who
        // rotates x-real-ip for an unlimited budget still cannot take the event
        // loop away from the clinicians already signed in. See hashGate.ts.
        //
        // Placed to cover BOTH the real verify and the timing dummy, so a
        // saturated server refuses unknown and known usernames identically and
        // the equalization is not undone by the gate itself.
        const slot = await withHashSlot(() =>
          verifyPassword(password, user && user.active ? user.passHash : TIMING_DUMMY_HASH)
        );
        if (!slot.ok) return null; // too busy to hash — not a credential verdict

        // Charged only now, on a genuinely failed verification. Both failure
        // paths below share it, so an unknown username costs an attacker the
        // same budget as a wrong password and neither is free.
        const chargeFailure = async () => {
          if (!pairKey || !ip) return;
          await recordFailure(db, pairKey, now, FREE_ATTEMPTS, IP_MAX_LOCK_MS);
          // The address, metered but NEVER used to refuse. Spraying many
          // usernames from one source is the shape of credential stuffing and a
          // manager should see it — but blocking on this key is precisely the
          // office-wide outage above, so it only ever writes a log row.
          // justLocked keeps that to one row per window: writing on every
          // refused request is what previously let anyone with a script inflate
          // the audit log (and its CSV export) without bound.
          const spray = await recordFailure(db, loginIpKey(ip), now, IP_FREE_ATTEMPTS, IP_MAX_LOCK_MS);
          if (spray.justLocked) {
            try {
              await logAction(db, {
                actorId: null, // a system observation; no account is known yet
                action: "auth.spray",
                target: ip,
                detail: `${IP_FREE_ATTEMPTS}+ failed sign-ins from this address`
              });
            } catch {
              // Same rule as logAuth: a logging failure must not become an outage.
            }
          }
        };

        if (!user || !user.active) {
          await chargeFailure();
          // Deliberately NOT logged. An unknown username is unbounded input, so
          // logging it would let anyone write arbitrary rows into the audit log
          // — and the log would then double as a list of guessed usernames.
          return null;
        }
        if (!slot.value) {
          await chargeFailure();
          // A real account with a wrong password IS worth recording: it is the
          // signal a practice manager needs to see. Bounded by the pair budget.
          await logAuth(db, "auth.failed", user.username, ip, user.id, user.displayName);
          return null;
        }
        // Second factor, checked ONLY after the password verified. Order
        // matters twice over: checking TOTP first would let an attacker probe
        // whether an account has MFA without knowing the password, and a
        // wrong code must cost the same throttle budget as a wrong password —
        // otherwise the second factor becomes a free oracle. The code check is
        // constant-cost (HMAC, no bcrypt), so it sits outside the hash gate.
        if (user.mfaEnabled && user.mfaSecret) {
          if (!verifyMfaCode(user.username, user.mfaSecret, totpCode)) {
            await chargeFailure();
            await logAuth(db, "auth.failed-mfa", user.username, ip, user.id, user.displayName);
            return null;
          }
        }
        // The right password ends the streak outright, so a clinician who
        // finally remembers it is not still serving a sentence — and, because
        // the gate above is now a read rather than a write, this is reachable
        // the moment a lock lapses instead of only after total silence.
        if (pairKey) await clearThrottle(db, pairKey);
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
