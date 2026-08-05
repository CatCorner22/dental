// Username shape shared by /setup, admin create, and ADMIN_USERNAME seed.
// Kept here so every surface says the same thing in the same words.

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 40;

// Starts with a letter or digit; then letters, digits, . _ - — mix freely.
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,39}$/i;

export function isValidUsername(username: string): boolean {
  return USERNAME_RE.test(username);
}

// Cold, unambiguous. The old "letters, digits, or . _ -" read like pick ONE
// class; people then thought the password had the same exclusive rule.
export function usernamePolicyError(username: string): string | null {
  const trimmed = username.trim();
  if (!trimmed) return "Pick a username.";
  if (!isValidUsername(trimmed)) {
    return (
      `Username must be ${USERNAME_MIN}–${USERNAME_MAX} characters. ` +
      "You may mix letters, digits, periods, underscores, and hyphens. No spaces."
    );
  }
  return null;
}
