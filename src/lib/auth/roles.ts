import type { ClinicalRole } from "./clinicalRoles";
// Role definitions live in their own edge-safe module (no db, no bcrypt) so
// both the middleware/edge config and the node runtime can import them.
//
// Two things are modelled here, and they are NOT the same thing:
//
//  1. RANK — a ladder used for "do you have at least this much access?"
//     (requireRole / meetsRole). Monotonic: higher rank sees and does more.
//
//  2. CAPABILITY — what an actor may do TO A PARTICULAR TARGET. This is not a
//     ladder. A Hierarchy Manager is the top of the practice yet may only ever
//     create Team Leads; a Team Lead may reset a password but must never see
//     one. Expressing that as "rank >= X" would quietly grant everything below,
//     which is exactly the authority creep this hierarchy exists to prevent.
//
// Every call site uses a NAMED predicate from this file rather than comparing
// role strings inline. Scattered `role === "admin"` checks are how a new role
// silently inherits powers nobody intended.

export type Role = "readonly" | "user" | "lead" | "manager" | "admin";

// `admin` keeps its stored value for backward compatibility with every account
// and audit row already in the database; only its LABEL becomes
// "Smile Notes Developer". Renaming the enum value would be a migration with no
// user-visible benefit.
export const ROLE_RANK: Record<Role, number> = {
  readonly: 0,
  user: 1,
  lead: 2,
  manager: 3,
  admin: 4
};

export const ROLE_LABEL: Record<Role, string> = {
  readonly: "Read only",
  user: "Team Member",
  lead: "Team Lead",
  manager: "Hierarchy Manager",
  admin: "Smile Notes Developer"
};

export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  noticeAcked: boolean;
  /**
   * Scope of practice — assistant, hygienist, dentist, or not yet recorded.
   *
   * Read fresh from the database by requireRole, never from the token, for the
   * same reason `role` is: a scope corrected after someone signed in must take
   * effect on their next request, not in thirty days.
   */
  clinicalRole: ClinicalRole;
  /**
   * Has this person finished the dictation practice session?
   *
   * On the PERSON, not the browser. It used to be a localStorage key, so the
   * read-aloud came back on every new computer, profile and private window —
   * which in an operatory of shared workstations meant it never stayed done.
   * Optional on the interface because requireRole builds a SessionUser too and
   * has no reason to carry it.
   */
  dictationEnrolled?: boolean;
  /** Which regional prompt set was used, for recognizer hinting. */
  dictationRegion?: string | null;
}

export function meetsRole(role: Role | undefined, min: Role): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

// ---------------------------------------------------------------------------
// Note capabilities
// ---------------------------------------------------------------------------

// Who can see the whole practice's Smile Notes rather than only their own.
//
// An ALLOWLIST, not an exclusion. The previous spelling was `role !== "user"`,
// which meant every role added in future got practice-wide read on the clinical
// record by accident — the default was "sees everything" and you had to
// remember to opt out. Now the default is "sees only their own" and each
// grant is a deliberate line in this array.
//
// `readonly` is on the list on purpose, even though it is the LOWEST rank. The
// role exists to give someone a practice-wide view with no ability to change
// anything (a biller, a locum, an outside reviewer). Scope it to "own notes"
// and the account can see nothing at all, because it can never author a note —
// the role would have no function. It is a real grant, so it is stated here in
// one place rather than falling out of a `!==`, and it is the reason a
// read-only account must be issued as deliberately as a privileged one.
const PRACTICE_WIDE_READERS: readonly Role[] = ["readonly", "lead", "manager", "admin"];

export function seesAllNotes(role: Role): boolean {
  return PRACTICE_WIDE_READERS.includes(role);
}

// Editing someone else's clinical note is a developer action, not an
// oversight one: a Team Lead can see and reassign a note but must not put
// words in a clinician's record.
export function canWriteNote(role: Role, ownerId: string, userId: string): boolean {
  if (!meetsRole(role, "user")) return false; // readonly never writes
  return role === "admin" || ownerId === userId;
}

export function canTransferNotes(role: Role): boolean {
  return meetsRole(role, "lead");
}

// ---------------------------------------------------------------------------
// User-management capabilities — keyed on the TARGET's role, not just the actor
// ---------------------------------------------------------------------------

// The highest role each actor may act upon. Everything above this is refused,
// so authority can never be escalated by acting on someone more powerful.
const MANAGE_CEILING: Partial<Record<Role, Role>> = {
  lead: "user", // Team Lead handles the rank and file
  manager: "lead", // Hierarchy Manager handles Team Leads
  admin: "admin" // Smile Notes Developer handles anyone
};

export function canActOn(actor: Role, target: Role): boolean {
  const ceiling = MANAGE_CEILING[actor];
  if (!ceiling) return false;
  return ROLE_RANK[target] <= ROLE_RANK[ceiling];
}

// A note's owner must be someone who can actually work it: never a read-only
// account. Named so the transfer route, the merge route, and the dashboard
// picker share one rule instead of three inline `role === "readonly"` copies.
export function canReceiveTransfer(role: Role): boolean {
  return role !== "readonly";
}

// Who may CREATE an account at a given role. A Hierarchy Manager is top of the
// practice but, per the hierarchy, may only ever add Team Leads — not more
// managers, and not rank-and-file accounts.
export function canAddUser(actor: Role, targetRole: Role): boolean {
  if (actor === "admin") return true;
  if (actor === "manager") return targetRole === "lead";
  if (actor === "lead") return targetRole === "readonly" || targetRole === "user";
  return false;
}

// Who may CHANGE an account's role, and to what. Same rule as creation: a
// manager may only ever produce a Team Lead.
export function canAssignRole(actor: Role, currentRole: Role, newRole: Role): boolean {
  if (actor === "admin") return true;
  if (actor === "manager") return canActOn(actor, currentRole) && newRole === "lead";
  return false; // Team Leads cannot change anyone's role
}

export function canMergeUsers(actor: Role, sourceRole: Role): boolean {
  return canActOn(actor, sourceRole);
}

export function canSendResetLink(actor: Role, targetRole: Role): boolean {
  return canActOn(actor, targetRole);
}

// Changing the address on an EXISTING account is not the same power as sending
// a link to the address already on file. Whoever controls the destination
// controls the account: repoint the email, mail yourself a link, and you can
// sign Smile Notes in someone else's name — which is precisely the frozen
// attribution the merge rules exist to protect. So editing contact details
// needs Hierarchy Manager authority, one tier above the reset-link tier.
//
// Setting an address at CREATION time is deliberately not restricted this way:
// a brand-new account has no history to steal, and a Team Lead must be able to
// invite someone. A typo'd address is fixed by a manager or by deactivating and
// re-inviting — the annoying direction, but the safe one.
export function canEditContact(actor: Role, targetRole: Role): boolean {
  return meetsRole(actor, "manager") && canActOn(actor, targetRole);
}

// Setting or reading a password directly is developer-only. Team Leads and
// Hierarchy Managers reset ONLY by emailing a link, so a practice manager can
// restore access without ever learning a credential.
export function canSetPasswordDirectly(actor: Role): boolean {
  return actor === "admin";
}

// Does this actor have any user-management surface at all (nav/page access)?
export function canManageUsers(role: Role): boolean {
  return meetsRole(role, "lead");
}

// Deactivating is reversible; deleting is not. The capability matrix grants a
// Team Lead add/merge/reset — not permanent removal — so deletion needs a
// Hierarchy Manager or Developer even for an account inside the lead's ceiling.
export function canDeactivate(actor: Role, targetRole: Role): boolean {
  return canActOn(actor, targetRole);
}

export function canDeleteUser(actor: Role, targetRole: Role): boolean {
  return meetsRole(actor, "manager") && canActOn(actor, targetRole);
}

// Kept as the "may this actor modify this row at all" gate.
export function canDeactivateOrDelete(actor: Role, targetRole: Role): boolean {
  return canActOn(actor, targetRole);
}

// ---------------------------------------------------------------------------
// Other capabilities
// ---------------------------------------------------------------------------

export function canReadAuditLog(role: Role): boolean {
  return meetsRole(role, "manager");
}

// Submitting a Data Hygiene Gauntlet ticket to the Smile Notes Team.
export function canSubmitChangeRequest(role: Role): boolean {
  return meetsRole(role, "lead");
}

// Practice packs Workflow — compose shipped verified blocks + module sets,
// dual-control approve, publish. Team Lead+; never writes another clinician's note.
export function canManagePracticePacks(role: Role): boolean {
  return meetsRole(role, "lead");
}

// A Hierarchy Manager is the practice's escalation path, so their contact
// details must not be a single personal mailbox that can go unread. The
// account carries a personal address AND a management group address.
export function requiresTwoEmails(role: Role): boolean {
  return role === "manager";
}
