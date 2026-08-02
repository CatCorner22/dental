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

// Doubling backoff, capped. Locks start small so a fumbling clinician waits
// seconds, not minutes, while a script hits the ceiling almost immediately.
export function lockMsFor(failCount: number, freeAttempts: number = FREE_ATTEMPTS): number {
  const over = failCount - freeAttempts;
  if (over <= 0) return 0;
  return Math.min(MAX_LOCK_MS, 1000 * 2 ** (over - 1) * 15);
}

export interface ThrottleState {
  locked: boolean;
  retryAfterSec: number;
}

const UNLOCKED: ThrottleState = { locked: false, retryAfterSec: 0 };

// Read-only check. Callers MUST call this before doing the expensive work.
export async function checkThrottle(db: Db, key: string, now: Date): Promise<ThrottleState> {
  const [row] = await db.select().from(authThrottle).where(eq(authThrottle.key, key)).limit(1);
  if (!row?.lockedUntil) return UNLOCKED;
  const remainingMs = row.lockedUntil.getTime() - now.getTime();
  if (remainingMs <= 0) return UNLOCKED;
  return { locked: true, retryAfterSec: Math.ceil(remainingMs / 1000) };
}

// Record a failure and return the state the NEXT attempt will see. The whole
// read-modify-write is one upsert so concurrent failed attempts cannot each
// read the same count and overwrite one another. freeAttempts lets a key type
// (e.g. per-IP) carry a larger budget than the per-account default.
export async function recordFailure(
  db: Db,
  key: string,
  now: Date,
  freeAttempts: number = FREE_ATTEMPTS
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
        // A stale streak (first failure older than the window, and no live
        // lock) restarts at 1 instead of compounding forever.
        failCount: sql`CASE
          WHEN ${authThrottle.firstFailAt} < ${windowStart}
           AND (${authThrottle.lockedUntil} IS NULL OR ${authThrottle.lockedUntil} < ${now})
          THEN 1 ELSE ${authThrottle.failCount} + 1 END`,
        firstFailAt: sql`CASE
          WHEN ${authThrottle.firstFailAt} < ${windowStart}
           AND (${authThrottle.lockedUntil} IS NULL OR ${authThrottle.lockedUntil} < ${now})
          THEN ${now} ELSE ${authThrottle.firstFailAt} END`
      }
    })
    .returning();

  const lockMs = lockMsFor(row.failCount, freeAttempts);
  if (lockMs <= 0) return UNLOCKED;
  const lockedUntil = new Date(now.getTime() + lockMs);
  await db.update(authThrottle).set({ lockedUntil }).where(eq(authThrottle.key, key));
  return { locked: true, retryAfterSec: Math.ceil(lockMs / 1000) };
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

// Login is throttled by client IP rather than by username. A username-keyed
// lock, checked before bcrypt, lets anyone who knows a username hold the real
// account owner out (and does nothing about an attacker who simply varies the
// username to keep spending bcrypt CPU). Keying on IP fixes both: it bounds
// one source's bcrypt spend across every username, and it cannot trap a
// legitimate user who logs in from a different address.
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
