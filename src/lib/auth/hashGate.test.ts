import { describe, expect, it, beforeEach } from "vitest";
import { MAX_CONCURRENT_HASHES, hashesInFlight, resetHashGate, withHashSlot } from "./hashGate";

// The gate is the only login defence that is not keyed on something the caller
// can choose. If it stops holding, an attacker who rotates a forwarding header
// gets the event loop, and the practice's already-signed-in clinicians get a
// page that never loads.
describe("withHashSlot", () => {
  beforeEach(resetHashGate);

  const never = () => new Promise<boolean>(() => {}); // occupies a slot forever

  it("runs the work and returns its value when a slot is free", async () => {
    const r = await withHashSlot(async () => true);
    expect(r).toEqual({ ok: true, value: true });
  });

  it("refuses once the cap is reached, and admits again as slots free", async () => {
    const release: (() => void)[] = [];
    const held = Array.from({ length: MAX_CONCURRENT_HASHES }, () =>
      withHashSlot(() => new Promise<boolean>((res) => release.push(() => res(true))))
    );
    // Let the slot counter settle before probing it.
    await Promise.resolve();
    expect(hashesInFlight()).toBe(MAX_CONCURRENT_HASHES);

    expect(await withHashSlot(never)).toEqual({ ok: false });

    release[0]!();
    await held[0];
    expect(await withHashSlot(async () => 7)).toEqual({ ok: true, value: 7 });

    release.slice(1).forEach((r) => r());
    await Promise.all(held);
  });

  // A refusal is NOT a credential verdict. Returning a discriminated result
  // rather than `false` is what stops "the server was busy" being reported to
  // the user as "your password is wrong" — and, worse, being counted as a
  // failed attempt against their address.
  it("distinguishes a refusal from a false result", async () => {
    const wrongPassword = await withHashSlot(async () => false);
    expect(wrongPassword.ok).toBe(true);
    expect(wrongPassword).toEqual({ ok: true, value: false });
  });

  // Without the finally, a handful of malformed stored hashes would leak every
  // slot and wedge login permanently until someone restarted the process.
  it("frees the slot when the work throws", async () => {
    for (let i = 0; i < MAX_CONCURRENT_HASHES + 3; i++) {
      await expect(
        withHashSlot(async () => {
          throw new Error("bad hash");
        })
      ).rejects.toThrow("bad hash");
    }
    expect(hashesInFlight()).toBe(0);
    expect(await withHashSlot(async () => "still working")).toEqual({
      ok: true,
      value: "still working"
    });
  });
});
