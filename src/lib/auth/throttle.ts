import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { authThrottle } from "@/lib/db/schema";

// Failed-authentication throttle.
//
// Every login runs bcrypt at cost 12 — deliberately expensive, which is right
// for hashing and wrong as an unmetered service an anonymous caller can invoke
// in a loop. Unthrottled it is both a password-guessing surface and a cheap
// way to saturate the CPU. The same applies to the change-password route,
// which answers "is this the current password?" for anyone holding a session.
//
// The counter lives in the database rather than process memory: a restart, a
// cold start, or a second instance must not hand an attacker a fresh budget.

export const FREE_ATTEMPTS = 5; // typos happen; the first few cost nothing
export const WINDOW_MS = 15 * 60 * 1000; // failures older than this are forgiven
export const MAX_LOCK_MS = 15 * 60 * 1000;

// Login throttling is keyed by IP, not by username (see auth.ts for why). A
// whole dental office can sit behind one NAT address, so the IP budget is far
// larger than the per-account one — it is a CPU/abuse backstop, not an
// account lock, and must not trip on a busy Monday morning of fumbled logins.
export const IP_FREE_ATTEMPTS = 30;

// ...and for the same reason its LOCK is short. Every other key in this file
// locks one account or one action; an IP key locks a building. A practice all
// sharing one NAT address means an outsider's spray, or one temp staffer
// fumbling a password, takes the whole office offline for the duration — so
// the duration has to be something a front desk can absorb.
//
// A minute still does the job it exists to do. The point of the gate is to
// stop an anonymous caller burning cost-12 bcrypt in a loop; after the first
// burst this caps a source at roughly one hash a minute, which is ~60 guesses
// an hour against a password policy that makes that meaningless. Fifteen
// minutes buys almost no additional protection and costs a working morning.
export const IP_MAX_LOCK_MS = 60 * 1000;

// Doubling backoff, capped. Locks start small so a fumbling clinician waits
// seconds, not minutes, while a script hits the ceiling almost immediately.
export function lockMsFor(
  failCount: number,
  freeAttempts: number = FREE_ATTEMPTS,
  maxLockMs: number = MAX_LOCK_MS
): number {
  const over = failCount - freeAttempts;
  if (over <= 0) return 0;
  return Math.min(maxLockMs, 1000 * 2 ** (over - 1) * 15);
}

export interface ThrottleState {
  locked: boolean;
  retryAfterSec: number;
  /**
   * True only on the call that APPLIED the lock — never on the calls that
   * merely bounce off one already in force.
   *
   * Callers use this to decide whether an event is worth recording. Anything
   * a locked-out caller can trigger by retrying (an audit row, an email, a
   * metric) must be gated on this, or the refusal becomes cheaper for the
   * attacker than for us and the throttle turns into an amplifier.
   */
  justLocked: boolean;
}

const UNLOCKED: ThrottleState = { locked: false, retryAfterSec: 0, justLocked: false };

// Read-only check. Callers MUST call this before doing the expensive work.
export async function checkThrottle(db: Db, key: string, now: Date): Promise<ThrottleState> {
  const [row] = await db.select().from(authThrottle).where(eq(authThrottle.key, key)).limit(1);
  if (!row?.lockedUntil) return UNLOCKED;
  const remainingMs = row.lockedUntil.getTime() - now.getTime();
  if (remainingMs <= 0) return UNLOCKED;
  return { locked: true, retryAfterSec: Math.ceil(remainingMs / 1000), justLocked: false };
}

// Record a failure and return the state the NEXT attempt will see. The whole
// read-modify-write is one upsert so concurrent failed attempts cannot each
// read the same count and overwrite one another. freeAttempts lets a key type
// (e.g. per-IP) carry a larger budget than the per-account default.
export async function recordFailure(
  db: Db,
  key: string,
  now: Date,
  freeAttempts: number = FREE_ATTEMPTS,
  maxLockMs: number = MAX_LOCK_MS
): Promise<ThrottleState> {
  const windowStart = new Date(now.getTime() - WINDOW_MS);
  // Failures are recorded for unknown usernames too — otherwise spraying
  // random names would be free. That makes this table attacker-writable, so
  // it is pruned on the same path that grows it: rows whose streak has gone
  // cold and whose lock has expired carry no information. Without this, a
  // spray of a million distinct usernames would leave a million rows behind.
  await db
    .delete(authThrottle)
    .where(
      and(
        lt(authThrottle.firstFailAt, windowStart),
        or(isNull(authThrottle.lockedUntil), lt(authThrottle.lockedUntil, now))
      )
    );
  const [row] = await db
    .insert(authThrottle)
    .values({ key, failCount: 1, firstFailAt: now, lockedUntil: null })
    .onConflictDoUpdate({
      target: authThrottle.key,
      set: {
        // Three transitions, and getting the interaction between them right is
        // the whole ballgame — the alternative shipped a self-renewing lock
        // that a running server confirmed could hold an address out forever.
        //
        //  (a) LIVE LOCK → freeze. While serving a lock the count does not
        //      move. Counting refused requests as failures is what let the
        //      lock renew itself: each bounce raised the count, a higher count
        //      computed a longer backoff, and re-applying it from `now` pinned
        //      the deadline in the future for as long as anyone kept knocking.
        //
        //  (b) SERVED LOCK → reset to 1. Once a lock's time has passed, the
        //      streak is spent: the next failure starts a fresh one, so the
        //      key hands back its free attempts instead of snapping straight
        //      back into an escalated lock. This is the line that makes the
        //      lock actually DECAY under sustained hammering rather than just
        //      recompute — without it, continuous guessing re-locks on the
        //      first failure after every expiry, which is a permanent ban by
        //      another name. The trade is no cross-lock escalation; the pair
        //      key and the process-wide hash cap carry the rate-limiting that
        //      escalation used to, so this is affordable now.
        //
        //  (c) STALE WINDOW → reset to 1. A streak whose first failure predates
        //      the window carries no information.
        failCount: sql`CASE
          WHEN ${authThrottle.lockedUntil} IS NOT NULL AND ${authThrottle.lockedUntil} > ${now}
          THEN ${authThrottle.failCount}
          WHEN ${authThrottle.lockedUntil} IS NOT NULL AND ${authThrottle.lockedUntil} <= ${now}
          THEN 1
          WHEN ${authThrottle.firstFailAt} < ${windowStart}
          THEN 1
          ELSE ${authThrottle.failCount} + 1 END`,
        firstFailAt: sql`CASE
          WHEN ${authThrottle.lockedUntil} IS NOT NULL AND ${authThrottle.lockedUntil} > ${now}
          THEN ${authThrottle.firstFailAt}
          WHEN ${authThrottle.lockedUntil} IS NOT NULL AND ${authThrottle.lockedUntil} <= ${now}
          THEN ${now}
          WHEN ${authThrottle.firstFailAt} < ${windowStart}
          THEN ${now}
          ELSE ${authThrottle.firstFailAt} END`,
        // Clear a lock the moment it is no longer live, in the SAME statement
        // that reset the count. Leaving the expired timestamp behind would make
        // every later failure match branch (b) and reset forever — unlimited
        // free attempts after the first lock. Cleared here, re-set below only if
        // the fresh count warrants it.
        lockedUntil: sql`CASE
          WHEN ${authThrottle.lockedUntil} IS NOT NULL AND ${authThrottle.lockedUntil} > ${now}
          THEN ${authThrottle.lockedUntil}
          ELSE NULL END`
      }
    })
    .returning();

  // Already serving a lock this call did not apply. Return the time still to
  // run — never a freshly computed one, which would extend it — and report
  // justLocked: false so the caller does no work on this path.
  const remainingMs = row.lockedUntil ? row.lockedUntil.getTime() - now.getTime() : 0;
  if (remainingMs > 0) {
    return { locked: true, retryAfterSec: Math.ceil(remainingMs / 1000), justLocked: false };
  }

  const lockMs = lockMsFor(row.failCount, freeAttempts, maxLockMs);
  if (lockMs <= 0) return UNLOCKED;
  const lockedUntil = new Date(now.getTime() + lockMs);

  // Applying the lock is CONDITIONAL, and that condition is the only thing
  // making `justLocked` mean what its callers rely on.
  //
  // This was an unconditional UPDATE, which quietly broke the guarantee: the
  // `lockedUntil` read back from the upsert above is written by THIS statement,
  // not by the upsert, so concurrent callers all saw NULL, all sailed past the
  // remainingMs check, and all returned justLocked: true. A hundred parallel
  // sign-in attempts therefore produced a hundred "newly locked" verdicts and a
  // hundred audit rows — restoring in a burst exactly the amplification the
  // flag exists to prevent.
  //
  // Guarding on "still unlocked" makes the write a compare-and-set: the first
  // caller to land takes the lock and is told so, and every other caller in the
  // burst matches nothing, gets an empty RETURNING, and reports the lock it
  // lost the race to. Exactly one justLocked per lock, whatever the concurrency.
  const applied = await db
    .update(authThrottle)
    .set({ lockedUntil })
    .where(
      and(
        eq(authThrottle.key, key),
        or(isNull(authThrottle.lockedUntil), lt(authThrottle.lockedUntil, now))
      )
    )
    .returning();

  if (applied.length === 0) {
    // Someone else locked it between our upsert and here. Report THEIR lock —
    // never ours, which was never stored and would over-report the wait.
    const existing = await checkThrottle(db, key, now);
    return existing.locked ? existing : UNLOCKED;
  }
  return { locked: true, retryAfterSec: Math.ceil(lockMs / 1000), justLocked: true };
}

// A correct credential clears the streak, so a user who finally remembers
// their password is not still serving a sentence. (Login is keyed by IP, so
// this also means a good login clears that IP's budget; it never lets an
// attacker's failures leave a specific account locked — there is no per-account
// login lock to leave behind.)
export async function clearThrottle(db: Db, key: string): Promise<void> {
  await db.delete(authThrottle).where(eq(authThrottle.key, key));
}

// The login form accepts any string, so the username reaching this is
// unvalidated input that becomes a primary key. Truncated so a caller cannot
// write megabyte-wide rows, and lowercased so "Admin" and "admin" share one
// budget rather than doubling an attacker's free attempts per casing.
const MAX_KEY_CHARS = 80;

export function loginKey(username: string): string {
  return `login:${username.toLowerCase().slice(0, MAX_KEY_CHARS)}`;
}

// Login is throttled on the PAIR (source address, username) — not on either
// one alone. Both single-field designs were tried and both are broken:
//
//   username alone — anyone who knows a username holds the real owner out from
//   anywhere on the internet. A pure denial-of-service handed to strangers.
//
//   address alone — this is the one that shipped, and it is worse in a dental
//   practice than it looks on paper. A whole office sits behind one NAT
//   address, so ONE outsider hammering the login form spends the budget that
//   the entire practice shares, and every clinician is refused with the right
//   password in their hands. Measured against a running server: 70 seconds of
//   uninterrupted guessing kept the correct password locked out, and the only
//   escape was a 15-minute idle window the attacker simply never allows.
//
// The pair fixes the collateral damage: an attacker grinding on "drhoward"
// cannot touch the budget of the hygienist signing in as "mreyes" from the
// next room. To lock a colleague out you must already be inside the practice's
// network AND targeting that colleague by name — a far smaller blast radius
// than "anyone on the internet closes the whole office".
//
// What the pair gives up is the cross-username CPU bound: a caller varying the
// username gets a fresh budget each time. That objection is answered somewhere
// better — hashGate.ts caps concurrent bcrypt process-wide, on a key nobody can
// forge — which is why the pair is affordable now and was not before.
export function loginPairKey(ip: string, username: string): string {
  return `login:${ip.slice(0, MAX_KEY_CHARS)}|${username.toLowerCase().slice(0, MAX_KEY_CHARS)}`;
}

// The address alone, kept as a DETECTOR and never as a gate.
//
// Spraying many usernames from one source is the shape of credential stuffing,
// and a practice manager should see it. But refusing on this key is exactly the
// office-wide outage described above, so nothing may block on it: it is
// recorded, it trips, it writes one audit row, and the sign-in proceeds on the
// pair budget regardless.
export function loginIpKey(ip: string): string {
  return `loginip:${ip.slice(0, MAX_KEY_CHARS)}`;
}

export function passwordCheckKey(userId: string): string {
  return `pwcheck:${userId}`;
}

// Keyed by draft, not by user: the thing being metered is repeated mail about
// one note, and an admin resending for someone else draws from the same
// budget as the owner.
export function resendKey(draftId: string): string {
  return `resend:${draftId}`;
}

// Keyed by the TARGET account, not the actor. Looping reset links at one
// person is a mail bomb aimed at them, and — because issuing a link retires
// the previous one — a way to break a reset they are halfway through. Two
// different managers hammering the same colleague draw from one budget.
export function resetLinkKey(userId: string): string {
  return `resetlink:${userId}`;
}

// Keyed by the actor: the thing being metered is one person minting accounts,
// each of which sends mail and adds a row.
export function inviteKey(actorId: string): string {
  return `invite:${actorId}`;
}

// Keyed by the actor. An export is the most expensive read in the app — up to
// 5,000 rows assembled into a string in memory — AND it writes an audit row,
// which is itself exportable. Left unmetered that is a loop that feeds itself:
// each export makes the next export's audit table bigger. Metering the actor
// (not the table) is what closes it, since the amplification comes from one
// person repeating the request, whichever table they aim at.
export function exportKey(actorId: string): string {
  return `export:${actorId}`;
}
