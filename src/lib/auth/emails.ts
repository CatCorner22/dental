import type { Role } from "./roles";
import { requiresTwoEmails } from "./roles";

// Deliberately permissive: this is a delivery sanity check, not an attempt to
// implement RFC 5322. The only real proof an address works is that a link sent
// to it gets used, so the goal here is to catch typos and obvious junk without
// rejecting a legitimate address the practice actually uses.
const EMAIL_RE = /^[^\s@,;:<>()[\]\\]+@[^\s@.,;:<>()[\]\\]+(\.[^\s@.,;:<>()[\]\\]+)+$/;

export const EMAIL_MAX = 254; // the practical limit for an address

export function isValidEmail(value: string): boolean {
  const v = value.trim();
  return v.length > 0 && v.length <= EMAIL_MAX && EMAIL_RE.test(v);
}

export function normalizeEmail(value: string): string {
  // Case-insensitive comparison, but the stored form keeps what was typed
  // apart from surrounding whitespace — some mail systems are case-sensitive
  // in the local part, so we do not lowercase what we send to.
  return value.trim();
}

export function sameEmail(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export interface EmailFields {
  email: string | null;
  groupEmail: string | null;
}

// Validates the address rules for a role. A Hierarchy Manager is the practice's
// escalation path, so their account must carry BOTH a personal address and a
// management group address, and the two must genuinely differ — a manager whose
// "group" address is just their own mailbox is a single point of failure
// wearing a second hat.
export function emailPolicyError(role: Role, fields: EmailFields): string | null {
  const email = fields.email?.trim() ?? "";
  const groupEmail = fields.groupEmail?.trim() ?? "";

  if (email && !isValidEmail(email)) return "Enter a valid email address.";
  if (groupEmail && !isValidEmail(groupEmail)) return "Enter a valid management group email.";

  if (requiresTwoEmails(role)) {
    if (!email) return "A Hierarchy Manager needs a personal email address.";
    if (!groupEmail) {
      return "A Hierarchy Manager needs a management group email address as well.";
    }
    if (sameEmail(email, groupEmail)) {
      return "The two addresses must be different — the group address must reach more than one person.";
    }
  }
  return null;
}

// Where a password-reset link should be sent for this account.
export function resetDestination(fields: EmailFields): string | null {
  const email = fields.email?.trim();
  return email && isValidEmail(email) ? email : null;
}
