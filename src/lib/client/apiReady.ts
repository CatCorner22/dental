"use client";

/**
 * WHEN THIS BROWSER IS ALLOWED TO CALL AN API.
 *
 * The server refuses every route with 403 until the legal-record notice has
 * been acknowledged, and the note builder mounts the instant somebody signs in
 * — so any component that fetches on mount is in a race with a dialog, and
 * loses it on a fresh session. BlockChips already documents this and dodges it
 * by mounting its fetch lazily; the same hazard has since been walked into
 * twice more, by the practice-packs load in BuilderShell and the SuperByte
 * deployment probe.
 *
 * The damage is not a broken feature — both callers treat a failure as "no
 * data" and carry on — it is a red `403 (Forbidden)` in the console on the
 * first load of the app, every time, for everyone. The cross-browser smoke
 * test asserts there are no console errors, and it is right to: a console that
 * always has an error in it is a console nobody reads, which is where the next
 * real error goes to hide.
 *
 * So: one flag, set once, by the one component that knows. Deliberately a
 * module rather than a context — the acknowledgment lives in the root layout
 * and the fetches live in the page, which React context cannot span here
 * without threading a provider through both trees, and this needs no
 * re-render to do its job.
 */

let ready = false;
const waiting = new Set<() => void>();

/**
 * The notice is acknowledged (or was already, on a returning visit). Called by
 * SessionNotices, which is rendered in the root layout for every signed-in
 * page and is the single source of that fact.
 */
export function markApiReady(): void {
  if (ready) return;
  ready = true;
  // Copied before iterating: a callback that registers another waiter must not
  // mutate the set being walked.
  const pending = [...waiting];
  waiting.clear();
  for (const fn of pending) fn();
}

export function isApiReady(): boolean {
  return ready;
}

/**
 * Run `fn` as soon as APIs are allowed — immediately if they already are.
 *
 * Returns an unsubscribe for effect cleanup, so a component that unmounts
 * while still waiting does not fire into a dead tree.
 */
export function whenApiReady(fn: () => void): () => void {
  if (ready) {
    fn();
    return () => {};
  }
  waiting.add(fn);
  return () => {
    waiting.delete(fn);
  };
}

/** Test-only: module state outlives a single test without this. */
export function resetApiReady(): void {
  ready = false;
  waiting.clear();
}
