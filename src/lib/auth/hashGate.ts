// A concurrency cap on password hashing, keyed on nothing.
//
// WHY THIS EXISTS. Every other defence around login is keyed on the client
// address, and the client address comes from a header (see clientIp.ts). A
// caller who can vary that header gets a fresh budget per request, so the
// per-IP throttle bounds a POLITE attacker and nothing else. This gate is the
// one that holds regardless, because the thing it meters is our own CPU and
// there is no field an attacker can set to get more of it.
//
// WHY CONCURRENCY AND NOT A RATE. bcryptjs is a pure-JavaScript implementation:
// its "async" mode chunks work across setImmediate rather than handing it to a
// thread pool, so every in-flight hash is competing for the SAME event loop
// that serves every other request. Cost 12 is ~250ms of that loop. Ten
// concurrent logins do not take 250ms each — they interleave, and the whole
// process stops answering, including the pages of clinicians who are already
// signed in and mid-note. Capping requests-per-second would not prevent that;
// capping how many run AT ONCE is exactly the invariant worth holding.
//
// WHY REFUSE RATHER THAN QUEUE. A queue converts a CPU problem into a memory
// problem and hands the attacker a slower, quieter version of the same win: the
// waiting requests still hold connections, and a legitimate user's login sits
// behind however many guesses arrived first. Refusing immediately keeps latency
// bounded for everyone and makes the failure legible — the caller is told to
// retry in a moment, which is true.
//
// This is per-process, which is correct: each instance is protecting its own
// event loop, so N instances allow N × the work and each one stays responsive.

// Four leaves headroom on a single core for everything that is not hashing,
// while still absorbing a whole operatory signing in at once — a practice has
// tens of staff, not thousands, and a real login burst is a handful of
// simultaneous requests, not dozens.
const DEFAULT_MAX = 4;

const parsed = Math.trunc(Number(process.env.MAX_CONCURRENT_HASHES));
export const MAX_CONCURRENT_HASHES = parsed > 0 ? parsed : DEFAULT_MAX;

let inFlight = 0;

/** Live count, for tests and diagnostics. */
export function hashesInFlight(): number {
  return inFlight;
}

export type SlotResult<T> = { ok: true; value: T } | { ok: false };

/**
 * Run `fn` if a hashing slot is free, otherwise refuse.
 *
 * Returns `{ ok: false }` rather than throwing, so a caller cannot accidentally
 * treat "we were too busy to check" as "the password was wrong" — those must
 * lead to different responses (503 vs 401), and an exception is far too easy to
 * catch into the wrong one.
 *
 * The slot is released in `finally`, so a hash that throws — a malformed stored
 * hash, an out-of-memory — frees its slot instead of permanently shrinking the
 * pool until restart. Without that, N such errors would wedge login for good.
 */
export async function withHashSlot<T>(fn: () => Promise<T>): Promise<SlotResult<T>> {
  if (inFlight >= MAX_CONCURRENT_HASHES) return { ok: false };
  inFlight++;
  try {
    return { ok: true, value: await fn() };
  } finally {
    inFlight--;
  }
}

/** Test-only: drop the counter back to zero between cases. */
export function resetHashGate(): void {
  inFlight = 0;
}
