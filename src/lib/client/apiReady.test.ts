import { beforeEach, describe, expect, it, vi } from "vitest";

import { isApiReady, markApiReady, resetApiReady, whenApiReady } from "./apiReady";

// THE RACE THIS EXISTS TO LOSE ON PURPOSE.
//
// The server answers 403 to every route until the legal-record notice has been
// acknowledged, and the note builder mounts the instant somebody signs in. Two
// components fetched on mount anyway — the practice-packs load and the
// SuperByte deployment probe — so on a fresh session both fired while the
// blocking dialog was still up. Both handle the failure, so nothing broke; what
// they left behind was a red `403 (Forbidden)` in the console on the first load
// of the app, every time, for everyone. The cross-browser smoke test asserts
// there are no console errors, and it should: a console that always has an
// error in it is a console nobody reads.

beforeEach(() => resetApiReady());

describe("waiting for the notice", () => {
  it("holds a caller until the gate opens", () => {
    const run = vi.fn();
    whenApiReady(run);
    expect(run).not.toHaveBeenCalled();
    markApiReady();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("runs a late caller immediately", () => {
    // A component that mounts after the acknowledgment — a second note opened
    // in the same session — must not wait for an event that already happened.
    markApiReady();
    const run = vi.fn();
    whenApiReady(run);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("releases everyone waiting, once", () => {
    const a = vi.fn();
    const b = vi.fn();
    whenApiReady(a);
    whenApiReady(b);
    markApiReady();
    markApiReady();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("forgets a caller that unmounted first", () => {
    // The builder can be torn down before the dialog is dismissed. Firing into
    // a dead tree is a setState-after-unmount warning, which is another console
    // error to have chased.
    const run = vi.fn();
    const stop = whenApiReady(run);
    stop();
    markApiReady();
    expect(run).not.toHaveBeenCalled();
  });

  it("survives a callback that registers another one", () => {
    // Walking the set while a callback mutates it would either skip a waiter or
    // throw, depending on the engine.
    const inner = vi.fn();
    whenApiReady(() => whenApiReady(inner));
    markApiReady();
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it("reports its own state", () => {
    expect(isApiReady()).toBe(false);
    markApiReady();
    expect(isApiReady()).toBe(true);
  });
});
