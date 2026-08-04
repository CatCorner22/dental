import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp
} from "drizzle-orm/pg-core";
import type { NoteState } from "@/lib/schema/types";

// PGlite is real Postgres, so pgEnum / jsonb / serial work identically on both
// the pg and PGlite drivers.
// "admin" keeps its stored value (it is now labelled "Smile Notes Developer"
// in the UI) so existing accounts and audit rows need no migration. New values
// are appended — an enum's declared order is not its authority here; rank lives
// in ROLE_RANK.
export const roleEnum = pgEnum("role", ["readonly", "user", "admin", "lead", "manager"]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  role: roleEnum("role").notNull().default("user"),
  passHash: text("pass_hash").notNull(),
  active: boolean("active").notNull().default(true),
  noticeAckAt: timestamp("notice_ack_at", { withTimezone: true }),
  // Where a password-reset link is sent. Optional for most roles; a Hierarchy
  // Manager must have BOTH this and groupEmail (see requiresTwoEmails) so the
  // practice's escalation path is never one unread personal mailbox.
  email: text("email"),
  groupEmail: text("group_email"),
  // Session revocation watermark: a JWT minted before this instant is dead.
  // Null = the password has never been changed since account creation.
  passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }),
  // The other half of the watermark: set by "sign out on all devices", which
  // is how someone kills a session they left open on an operatory machine
  // WITHOUT having to change their password. Compared together with
  // passwordChangedAt — see sessionWatermark().
  sessionsRevokedAt: timestamp("sessions_revoked_at", { withTimezone: true }),
  // Who last repointed the reset-link destination, and when.
  //
  // Changing an address and then mailing yourself the reset link is a complete
  // account takeover in two requests: you become that person and can sign
  // Smile Notes in their name. These two columns let the reset-link route
  // enforce separation of duties — the actor who moved the address is not the
  // actor who may send a link to it. Nothing else reads them.
  emailChangedAt: timestamp("email_changed_at", { withTimezone: true }),
  emailChangedBy: text("email_changed_by"),
  // Who created this account. Used to stop an actor handing another
  // clinician's work to an account they themselves minted and control.
  createdById: text("created_by_id"),
  // Scope of practice — assistant, hygienist, dentist, or not yet recorded.
  //
  // A SEPARATE axis from `role` above. That one governs what an account may do
  // to the system; this governs what the person may write in a clinical record,
  // which in Tennessee is decided by licence rather than by seniority. A
  // practice manager may hold no licence; a dentist may hold the lowest system
  // role. See clinicalRoles.ts.
  //
  // Plain text with a default rather than an enum: the set may grow (expanded
  // -function assistant, therapist) and ALTER TYPE ... ADD VALUE has caused
  // enough trouble in this schema already.
  clinicalRole: text("clinical_role").notNull().default("unset"),
  // TOTP multi-factor authentication. The secret is stored only while MFA is
  // pending or enabled; disabling clears it. Base32, never logged, never
  // returned by any API after enrollment confirms.
  mfaSecret: text("mfa_secret"),
  mfaEnabled: boolean("mfa_enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

// A practice location. Configuration, never code — the app is a product, and
// the next practice has a different number of them with different names.
export const offices = pgTable("offices", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  // Short form for the note header and the export column, where the full
  // "Cornerstone Dental at Fort Sanders West" is too long to scan.
  shortCode: text("short_code").notNull(),
  address: text("address"),
  phone: text("phone"),
  // Optional per-office override for where filed notes are mailed. Falls back
  // to the practice-wide address when null.
  exportEmail: text("export_email"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

// Which offices a person works at — MANY, not one.
//
// A single "default office" was the wrong shape: staff rotate, so most people
// genuinely belong to several, and a lone default also created a way for the
// screen to show an office the record did not have. A set has neither problem.
//
// This is NOT a permission boundary. Every office remains selectable by
// everyone on every note, because a patient may be seen anywhere and cover is
// arranged at short notice. The assignment orders the picker and answers "who
// works where"; it never decides what anyone may write.
export const userOffices = pgTable(
  "user_offices",
  {
    userId: text("user_id").notNull(),
    officeId: text("office_id").notNull()
  },
  (t) => [primaryKey({ columns: [t.userId, t.officeId] })]
);

export const drafts = pgTable("drafts", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull().default("Untitled note"),
  // WHICH OFFICE THIS ENCOUNTER HAPPENED AT — a property of the visit, not of
  // the person writing it up. Staff rotate between locations and a patient may
  // be seen at one office for an emergency and another for recall, so this is
  // picked per note and never constrained by who is writing it. No FK: an
  // office can be retired while the notes written at it must still load.
  officeId: text("office_id"),
  noteState: jsonb("note_state").$type<NoteState>().notNull(),
  status: text("status").notNull().default("unfinished"),
  lastSendFailed: boolean("last_send_failed").notNull().default(false),
  // The submission this draft was filed as, or null when it has never been
  // filed or has been edited since. This — not the cached status string — is
  // what blocks a second filing of identical content, so a failed EMAIL can
  // leave the draft resendable without leaving it re-fileable.
  lastSubmissionId: integer("last_submission_id"),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const submissions = pgTable("submissions", {
  id: serial("id").primaryKey(), // ticket = formatTicket(id)
  draftId: text("draft_id")
    .notNull()
    .references(() => drafts.id),
  submittedById: text("submitted_by_id")
    .notNull()
    .references(() => users.id),
  submittedByName: text("submitted_by_name").notNull(), // frozen "Display (username)"
  officeId: text("office_id"),
  // FROZEN, for exactly the reason submittedByName is. Renaming an office, or
  // retiring one, must not silently rewrite where a filed note says the care
  // happened — that is a fact about a past encounter, and this record may form
  // part of a legal one.
  officeName: text("office_name"),
  submittedAtUtc: timestamp("submitted_at_utc", { withTimezone: true }).notNull().defaultNow(),
  submittedAtEt: text("submitted_at_et").notNull(),
  filename: text("filename").notNull(),
  format: text("format").notNull(),
  ruleVersion: text("rule_version").notNull(),
  auditStatus: text("audit_status").notNull(),
  noteMarkdown: text("note_markdown").notNull(), // frozen, with stamp
  auditReport: text("audit_report").notNull(), // frozen, with stamp
  // The note GPA, frozen at filing like the audit it derives from. Text
  // rather than a float column so "3.70" is stored exactly as stamped —
  // this is a grade on a record, not a quantity to sum.
  gpa: text("gpa"),
  gpaSubscores: jsonb("gpa_subscores").$type<Record<string, number>>(),
  // AI-assist provenance for this filing: which capabilities touched the
  // draft's text, under which prompt version, with which retrieved sources.
  // Hashes and identifiers only — never note text.
  assistProvenance: jsonb("assist_provenance").$type<Record<string, unknown>>()
});

// ---------------------------------------------------------------------------
// The points economy. APPEND-ONLY: a balance is the sum of a person's rows,
// never a column somebody's bug can overwrite. XP (lifetime rank progress) is
// the sum of POSITIVE rows only — spending points at the store must never
// demote anyone.

export const pointsLedger = pgTable("points_ledger", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  delta: integer("delta").notNull(), // positive: award; negative: redemption
  reason: text("reason").notNull(), // "note-gpa" | "badge:<id>" | "bounty:<scenario>" | "redeem:<item>"
  refType: text("ref_type"), // "submission" | "redemption" | "badge" | "training"
  refId: text("ref_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const storeItems = pgTable("store_items", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  detail: text("detail").notNull().default(""),
  cost: integer("cost").notNull(),
  tier: integer("tier").notNull().default(1),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const redemptions = pgTable("redemptions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  // Frozen like every attribution in this app: a rename must not rewrite who
  // asked for what.
  userName: text("user_name").notNull(),
  itemId: integer("item_id").notNull(),
  itemTitle: text("item_title").notNull(),
  cost: integer("cost").notNull(),
  status: text("status").notNull().default("requested"), // requested | approved | declined
  decidedByName: text("decided_by_name"),
  decidedNote: text("decided_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp("decided_at", { withTimezone: true })
});

export type PointsLedgerRow = typeof pointsLedger.$inferSelect;
export type StoreItemRow = typeof storeItems.$inferSelect;
export type RedemptionRow = typeof redemptions.$inferSelect;

// Personal saved blocks — each writer's own reusable starting text. Owner-
// private by query (every repo function filters on ownerId), de-identified by
// the same PHI screen that guards drafts.
export const userBlocks = pgTable("user_blocks", {
  id: serial("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export type UserBlockRow = typeof userBlocks.$inferSelect;

export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  actorId: text("actor_id"),
  // Frozen "Display (username)" at write time. actor_id has no FK on purpose
  // (the log outlives accounts), so without this snapshot every entry by a
  // later-deleted user would render as "unknown" forever.
  actorName: text("actor_name"),
  action: text("action").notNull(),
  target: text("target"),
  detail: text("detail")
});

// Failed-authentication throttle. Keyed by what is being protected — a
// username for login, a user id for the change-password check — so a single
// table covers both. Lives in the database, not process memory, so a restart
// or a second instance cannot reset an attacker's budget.
export const authThrottle = pgTable("auth_throttle", {
  key: text("key").primaryKey(),
  failCount: integer("fail_count").notNull().default(0),
  firstFailAt: timestamp("first_fail_at", { withTimezone: true }).notNull().defaultNow(),
  lockedUntil: timestamp("locked_until", { withTimezone: true })
});

export type UserRow = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type OfficeRow = typeof offices.$inferSelect;
export type UserOfficeRow = typeof userOffices.$inferSelect;
export type DraftRow = typeof drafts.$inferSelect;
export type NewDraft = typeof drafts.$inferInsert;
export type SubmissionRow = typeof submissions.$inferSelect;
export type AuditLogRow = typeof auditLog.$inferSelect;

// Password reset by link. Only a HASH of the token is stored: a leaked database
// dump must not hand anyone a working reset link, exactly as with passwords.
// Single-use (usedAt) and short-lived (expiresAt).
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  // Who sent the link — a Team Lead resetting an account is an auditable act.
  createdById: text("created_by_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export type AuthThrottleRow = typeof authThrottle.$inferSelect;
export type PasswordResetTokenRow = typeof passwordResetTokens.$inferSelect;



// The wish list: staff suggestions, supply requests, and — the one that
// matters most — observations that something has fallen below standard.
//
// DELIBERATELY LOW FRICTION, and deliberately the opposite of the Data Hygiene
// Gauntlet. The Gauntlet is hard on purpose because a schema change is
// expensive and permanent. A wish is cheap: the cost of a bad suggestion is
// that somebody reads a sentence and moves on, while the cost of a suppressed
// safety observation is unbounded. So there is no gate here beyond "say what
// you mean", and the standards category is one click away.
//
// NON-ANONYMOUS by design, at the owner's request. The author's name is frozen
// at write time like every other attribution in this app, so a later rename or
// deletion cannot rewrite who raised something. Attribution here is a feature,
// not surveillance: a supply request needs a person to ask follow-up questions
// of, and a standards concern needs someone who can describe what they saw.
export const wishes = pgTable("wishes", {
  id: serial("id").primaryKey(),
  // No FK: a wish outlives the account that raised it, exactly like the audit
  // log. The frozen name below is what keeps it readable afterwards.
  authorId: text("author_id"),
  authorName: text("author_name").notNull(), // frozen "Display (username)"
  category: text("category").notNull(),
  title: text("title").notNull(),
  detail: text("detail").notNull().default(""),
  status: text("status").notNull().default("new"),
  // Who last moved it, so "declined" is never anonymous either.
  decidedByName: text("decided_by_name"),
  decidedNote: text("decided_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export type WishRow = typeof wishes.$inferSelect;
export type NewWish = typeof wishes.$inferInsert;

export const schema = {
  roleEnum,
  users,
  drafts,
  submissions,
  auditLog,
  authThrottle,
  passwordResetTokens,
  wishes
};
