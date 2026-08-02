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
  action: text("action").notNull(),
  target: text("target"),
  detail: text("detail")
});

export type UserRow = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type DraftRow = typeof drafts.$inferSelect;
export type NewDraft = typeof drafts.$inferInsert;
export type SubmissionRow = typeof submissions.$inferSelect;
export type AuditLogRow = typeof auditLog.$inferSelect;

export const schema = { roleEnum, users, drafts, submissions, auditLog };
