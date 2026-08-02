// Temporary-password generator for admin onboarding/reset. Unambiguous
// characters only (no 0/O, 1/l/I), 14 chars ≈ 80 bits — far past the 10-char
// policy floor. Rejection sampling keeps the pick uniform.
const CHARSET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const GENERATED_PASSWORD_LENGTH = 14;

export function generatePassword(
  randomBytes: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))
): string {
  const limit = 256 - (256 % CHARSET.length); // rejection threshold
  let out = "";
  while (out.length < GENERATED_PASSWORD_LENGTH) {
    for (const byte of randomBytes(GENERATED_PASSWORD_LENGTH * 2)) {
      if (byte < limit && out.length < GENERATED_PASSWORD_LENGTH) {
        out += CHARSET[byte % CHARSET.length];
      }
    }
  }
  return out;
}
