import { describe, expect, it } from "vitest";
import { GENERATED_PASSWORD_LENGTH, generatePassword } from "./genPassword";

describe("generatePassword", () => {
  it("makes a 14-char password from the unambiguous charset", () => {
    const p = generatePassword();
    expect(p).toHaveLength(GENERATED_PASSWORD_LENGTH);
    expect(p).toMatch(/^[abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/);
    // Never the ambiguous look-alikes.
    expect(p).not.toMatch(/[0O1lI]/);
  });

  it("is different each call (no fixed output)", () => {
    expect(generatePassword()).not.toBe(generatePassword());
  });

  it("rejection-samples: bytes past the uniform limit are skipped, not biased", () => {
    // 55 chars -> limit 220. Feed one out-of-range byte (250) then in-range
    // bytes; the 250 must be skipped entirely rather than wrapped by modulo.
    let call = 0;
    const p = generatePassword((n) => {
      const arr = new Uint8Array(n);
      for (let i = 0; i < n; i++) arr[i] = call === 0 && i === 0 ? 250 : i % 55;
      call++;
      return arr;
    });
    expect(p).toHaveLength(GENERATED_PASSWORD_LENGTH);
    expect(p[0]).toBe("abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"[1 % 55]);
  });
});
