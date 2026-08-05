import bcrypt from "bcryptjs";

const COST = 12;

export const PASSWORD_MIN = 10;
// bcrypt ignores everything past 72 bytes, so a longer password is not
// actually stronger — it only silently collides with its own first 72 bytes.
// Capping here also keeps an unbounded string out of a cost-12 hash.
export const PASSWORD_MAX = 72;

// Shown under every password field. States WHAT is required and WHAT is not —
// people were reading username rules ("letters, digits, or …") as if the
// password allowed only one character class.
export const PASSWORD_HINT =
  `At least ${PASSWORD_MIN} characters. Mix letters, numbers, and symbols freely — ` +
  "there is no rule that limits you to only one type.";

// A short blocklist of long-but-trivial passwords that clear the length bar but
// are the first things an online guesser tries. Not a full breach corpus — a
// cheap floor that, combined with per-IP throttling, makes password spraying
// unproductive. Compared case-insensitively.
const COMMON_PASSWORDS = new Set([
  "password12",
  "password123",
  "password1234",
  "passw0rd12",
  "1234567890",
  "12345678910",
  "0123456789",
  "qwertyuiop",
  "qwerty12345",
  "1qaz2wsx3edc",
  "iloveyou123",
  "letmein1234",
  "welcome1234",
  "admin12345",
  "administrator",
  "changeme123",
  "trustno1234",
  "dentaloffice",
  "dentist123"
]);

// One policy, checked identically at setup, admin create, admin reset, and
// self-service change. Returns an error message, or null when acceptable.
export function passwordPolicyError(plain: string): string | null {
  if (plain.length < PASSWORD_MIN) {
    return (
      `Password must be at least ${PASSWORD_MIN} characters. ` +
      "Letters, numbers, and symbols may all be mixed — no character-type limit."
    );
  }
  if (Buffer.byteLength(plain, "utf8") > PASSWORD_MAX) {
    return `Password must be at most ${PASSWORD_MAX} bytes.`;
  }
  // Length is not entropy. Per-account lockout is gone (login throttles by IP),
  // so a weak-but-long password is only as safe as the IP budget lets it be —
  // reject the passwords a spray would try first. A single repeated character
  // ("aaaaaaaaaa") and the obvious common strings clear length but nothing else.
  const normalized = plain.toLowerCase();
  if (/^(.)\1+$/.test(plain)) {
    return "Password is too simple — it is a single repeated character.";
  }
  if (COMMON_PASSWORDS.has(normalized)) {
    return "That password is too common. Choose something less guessable.";
  }
  return null;
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
