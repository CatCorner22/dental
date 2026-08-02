import bcrypt from "bcryptjs";

const COST = 12;

export const PASSWORD_MIN = 10;
// bcrypt ignores everything past 72 bytes, so a longer password is not
// actually stronger — it only silently collides with its own first 72 bytes.
// Capping here also keeps an unbounded string out of a cost-12 hash.
export const PASSWORD_MAX = 72;

// One policy, checked identically at setup, admin create, admin reset, and
// self-service change. Returns an error message, or null when acceptable.
export function passwordPolicyError(plain: string): string | null {
  if (plain.length < PASSWORD_MIN) {
    return `Password must be at least ${PASSWORD_MIN} characters.`;
  }
  if (Buffer.byteLength(plain, "utf8") > PASSWORD_MAX) {
    return `Password must be at most ${PASSWORD_MAX} bytes.`;
  }
  return null;
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
