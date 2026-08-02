// Idempotent schema DDL, executed on bootstrap. Embedded as code (not read
// from the drizzle/ folder) so it bundles reliably into the Next server and
// runs identically on node-postgres, PGlite, and in tests. Keep in sync with
// schema.ts; the drizzle/ migrations remain for reference and optional
// build-step migration on managed Postgres.
export const SCHEMA_STATEMENTS: string[] = [
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role') THEN
       CREATE TYPE "role" AS ENUM ('readonly', 'user', 'admin');
     END IF;
   END $$;`,
  `CREATE TABLE IF NOT EXISTS "users" (
     "id" text PRIMARY KEY NOT NULL,
     "username" text NOT NULL UNIQUE,
     "display_name" text NOT NULL,
     "role" "role" DEFAULT 'user' NOT NULL,
     "pass_hash" text NOT NULL,
     "active" boolean DEFAULT true NOT NULL,
     "notice_ack_at" timestamp with time zone,
     "created_at" timestamp with time zone DEFAULT now() NOT NULL
   );`,
  `CREATE TABLE IF NOT EXISTS "drafts" (
     "id" text PRIMARY KEY NOT NULL,
     "owner_id" text NOT NULL REFERENCES "users"("id"),
     "title" text DEFAULT 'Untitled note' NOT NULL,
     "note_state" jsonb NOT NULL,
     "status" text DEFAULT 'unfinished' NOT NULL,
     "last_send_failed" boolean DEFAULT false NOT NULL,
     "version" integer DEFAULT 1 NOT NULL,
     "created_at" timestamp with time zone DEFAULT now() NOT NULL,
     "updated_at" timestamp with time zone DEFAULT now() NOT NULL
   );`,
  `CREATE TABLE IF NOT EXISTS "submissions" (
     "id" serial PRIMARY KEY NOT NULL,
     "draft_id" text NOT NULL REFERENCES "drafts"("id"),
     "submitted_by_id" text NOT NULL REFERENCES "users"("id"),
     "submitted_by_name" text NOT NULL,
     "submitted_at_utc" timestamp with time zone DEFAULT now() NOT NULL,
     "submitted_at_et" text NOT NULL,
     "filename" text NOT NULL,
     "format" text NOT NULL,
     "rule_version" text NOT NULL,
     "audit_status" text NOT NULL,
     "note_markdown" text NOT NULL,
     "audit_report" text NOT NULL
   );`,
  `CREATE TABLE IF NOT EXISTS "audit_log" (
     "id" serial PRIMARY KEY NOT NULL,
     "at" timestamp with time zone DEFAULT now() NOT NULL,
     "actor_id" text,
     "actor_name" text,
     "action" text NOT NULL,
     "target" text,
     "detail" text
   );`,
  `CREATE TABLE IF NOT EXISTS "auth_throttle" (
     "key" text PRIMARY KEY NOT NULL,
     "fail_count" integer DEFAULT 0 NOT NULL,
     "first_fail_at" timestamp with time zone DEFAULT now() NOT NULL,
     "locked_until" timestamp with time zone
   );`,
  // Additive columns for databases created before these existed. IF NOT
  // EXISTS keeps every statement idempotent across restarts.
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_changed_at" timestamp with time zone;`,
  `ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "actor_name" text;`,
  `ALTER TABLE "drafts" ADD COLUMN IF NOT EXISTS "last_submission_id" integer;`,
  // Backfill for drafts filed BEFORE this column existed. Without it every
  // already-submitted draft would read as never-filed the moment the column
  // was added, and the submit guard — which now keys on this — would happily
  // file a second ticket for each one.
  //
  // Scoped to drafts whose current status is still submitted/error, so a
  // draft that was submitted and then EDITED (status recomputed, and which
  // must stay submittable) is correctly left alone. Only ever touches legacy
  // NULLs, so re-running it on every bootstrap is a no-op.
  `UPDATE "drafts" SET "last_submission_id" = (
     SELECT MAX(s."id") FROM "submissions" s WHERE s."draft_id" = "drafts"."id"
   )
   WHERE "last_submission_id" IS NULL
     AND "status" IN ('submitted', 'error')
     AND EXISTS (SELECT 1 FROM "submissions" s WHERE s."draft_id" = "drafts"."id");`,
  `CREATE INDEX IF NOT EXISTS "auth_throttle_first_fail_idx" ON "auth_throttle" ("first_fail_at");`,
  // Every list view orders by these; without the indexes each dashboard and
  // history render is a full scan plus a sort.
  `CREATE INDEX IF NOT EXISTS "drafts_owner_updated_idx" ON "drafts" ("owner_id", "updated_at" DESC);`,
  `CREATE INDEX IF NOT EXISTS "drafts_updated_idx" ON "drafts" ("updated_at" DESC);`,
  `CREATE INDEX IF NOT EXISTS "submissions_draft_idx" ON "submissions" ("draft_id");`,
  `CREATE INDEX IF NOT EXISTS "submissions_by_user_idx" ON "submissions" ("submitted_by_id", "submitted_at_utc" DESC);`,
  `CREATE INDEX IF NOT EXISTS "submissions_at_idx" ON "submissions" ("submitted_at_utc" DESC);`,
  `CREATE INDEX IF NOT EXISTS "audit_log_at_idx" ON "audit_log" ("at" DESC, "id" DESC);`
];
