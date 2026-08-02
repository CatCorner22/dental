import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp
} from "drizzle-orm/pg-core";
import type { NoteState } from "@/lib/schema/types";

// PGlite is real Postgres, so pgEnum / jsonb / serial work identically on both
// the pg and PGlite drivers.
export const roleEnum = pgEnum("role", ["readonly", "user", "admin"]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  role: roleEnum("role").notNull().default("user"),
  passHash: text("pass_hash").notNull(),
  active: boolean("active").notNull().default(true),
  noticeAckAt: timestamp("notice_ack_at", { withTimezone: true }),
  // Session revocation watermark: a JWT minted before this instant is dead.
  // Null = the password has never been changed since account creation.
  passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const drafts = pgTable("drafts", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull().default("Untitled note"),
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
  submittedAtUtc: timestamp("submitted_at_utc", { withTimezone: true }).notNull().defaultNow(),
  submittedAtEt: text("submitted_at_et").notNull(),
  filename: text("filename").notNull(),
  format: text("format").notNull(),
  ruleVersion: text("rule_version").notNull(),
  auditStatus: text("audit_status").notNull(),
  noteMarkdown: text("note_markdown").notNull(), // frozen, with stamp
  auditReport: text("audit_report").notNull() // frozen, with stamp
});

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
export type DraftRow = typeof drafts.$inferSelect;
export type NewDraft = typeof drafts.$inferInsert;
export type SubmissionRow = typeof submissions.$inferSelect;
export type AuditLogRow = typeof auditLog.$inferSelect;

export type AuthThrottleRow = typeof authThrottle.$inferSelect;

export const schema = { roleEnum, users, drafts, submissions, auditLog, authThrottle };
