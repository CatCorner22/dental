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
  // New roles for databases created before the hierarchy existed. ALTER TYPE
  // ... ADD VALUE is not itself idempotent, so each is guarded by a pg_enum
  // lookup. Each runs as its own statement (never batched with a use of the new
  // value) because Postgres forbids using an enum value in the same transaction
  // that adds it.
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                    WHERE t.typname = 'role' AND e.enumlabel = 'lead') THEN
       ALTER TYPE "role" ADD VALUE 'lead';
     END IF;
   END $$;`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                    WHERE t.typname = 'role' AND e.enumlabel = 'manager') THEN
       ALTER TYPE "role" ADD VALUE 'manager';
     END IF;
   END $$;`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_changed_at" timestamp with time zone;`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" text;`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "group_email" text;`,
  // Provenance columns behind the separation-of-duties rules. No FK: these must
  // survive the referenced account being deleted, since the whole point is to
  // remember who did something after the fact.
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_changed_at" timestamp with time zone;`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_changed_by" text;`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "created_by_id" text;`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sessions_revoked_at" timestamp with time zone;`,
  // Practice locations. A table rather than a constant because the app is a
  // product: the next practice has a different number of offices with
  // different names, and a fork per customer is not a business.
  `CREATE TABLE IF NOT EXISTS "offices" (
     "id" text PRIMARY KEY NOT NULL,
     "name" text NOT NULL,
     "short_code" text NOT NULL,
     "address" text,
     "phone" text,
     "export_email" text,
     "active" boolean DEFAULT true NOT NULL,
     "sort_order" integer DEFAULT 0 NOT NULL,
     "created_at" timestamp with time zone DEFAULT now() NOT NULL
   );`,
  // Scope of practice, separate from the system role. Defaults to 'unset',
  // which restricts nothing — every existing account lands there, so enabling
  // this feature locks nobody out until the practice records who is who.
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "clinical_role" text DEFAULT 'unset' NOT NULL;`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_secret" text;`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_enabled" boolean DEFAULT false NOT NULL;`,
  // Which offices a person works at — MANY, not one. A lone "default office"
  // was the wrong shape: staff rotate, so most people belong to several.
  //
  // NOT a permission boundary. Every office stays selectable by everyone on
  // every note; this orders the picker and answers "who works where".
  `CREATE TABLE IF NOT EXISTS "user_offices" (
     "user_id" text NOT NULL,
     "office_id" text NOT NULL,
     PRIMARY KEY ("user_id", "office_id")
   );`,
  `CREATE INDEX IF NOT EXISTS "user_offices_office_idx" ON "user_offices" ("office_id");`,
  // Retire the abandoned single-default column if an earlier deploy created it.
  // Dropped rather than left in place: a column nothing reads is a column the
  // next reader assumes is authoritative.
  `ALTER TABLE "users" DROP COLUMN IF EXISTS "default_office_id";`,
  // Which office the ENCOUNTER happened at, chosen per note.
  `ALTER TABLE "drafts" ADD COLUMN IF NOT EXISTS "office_id" text;`,
  `ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "office_id" text;`,
  // Frozen at file time for the same reason submitted_by_name is: renaming or
  // retiring an office must not rewrite where a filed note says the care
  // happened. No FK anywhere on office_id, so a retired office never orphans
  // the notes written at it.
  `ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "office_name" text;`,
  `ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "gpa" text;`,
  `ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "gpa_subscores" jsonb;`,
  `ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "assist_provenance" jsonb;`,
  `CREATE TABLE IF NOT EXISTS "points_ledger" (
     "id" serial PRIMARY KEY NOT NULL,
     "user_id" text NOT NULL,
     "delta" integer NOT NULL,
     "reason" text NOT NULL,
     "ref_type" text,
     "ref_id" text,
     "created_at" timestamp with time zone DEFAULT now() NOT NULL
   );`,
  `CREATE INDEX IF NOT EXISTS "points_ledger_user_idx" ON "points_ledger" ("user_id", "created_at" DESC);`,
  // One award per submission, enforced by the database rather than by the
  // route remembering to check: a retried request cannot double-pay.
  `CREATE UNIQUE INDEX IF NOT EXISTS "points_ledger_ref_unique" ON "points_ledger" ("user_id", "ref_type", "ref_id") WHERE "ref_type" IS NOT NULL AND "ref_id" IS NOT NULL AND "delta" > 0;`,
  `CREATE TABLE IF NOT EXISTS "store_items" (
     "id" serial PRIMARY KEY NOT NULL,
     "title" text NOT NULL,
     "detail" text DEFAULT '' NOT NULL,
     "cost" integer NOT NULL,
     "tier" integer DEFAULT 1 NOT NULL,
     "active" boolean DEFAULT true NOT NULL,
     "created_at" timestamp with time zone DEFAULT now() NOT NULL
   );`,
  `CREATE TABLE IF NOT EXISTS "redemptions" (
     "id" serial PRIMARY KEY NOT NULL,
     "user_id" text NOT NULL,
     "user_name" text NOT NULL,
     "item_id" integer NOT NULL,
     "item_title" text NOT NULL,
     "cost" integer NOT NULL,
     "status" text DEFAULT 'requested' NOT NULL,
     "decided_by_name" text,
     "decided_note" text,
     "created_at" timestamp with time zone DEFAULT now() NOT NULL,
     "decided_at" timestamp with time zone
   );`,
  `CREATE INDEX IF NOT EXISTS "submissions_office_idx" ON "submissions" ("office_id", "submitted_at_utc" DESC);`,
  `CREATE TABLE IF NOT EXISTS "wishes" (
     "id" serial PRIMARY KEY NOT NULL,
     "author_id" text,
     "author_name" text NOT NULL,
     "category" text NOT NULL,
     "title" text NOT NULL,
     "detail" text NOT NULL DEFAULT '',
     "status" text NOT NULL DEFAULT 'new',
     "decided_by_name" text,
     "decided_note" text,
     "created_at" timestamp with time zone NOT NULL DEFAULT now(),
     "updated_at" timestamp with time zone NOT NULL DEFAULT now()
   );`,
  `CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
     "id" text PRIMARY KEY NOT NULL,
     "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
     "token_hash" text NOT NULL UNIQUE,
     "expires_at" timestamp with time zone NOT NULL,
     "used_at" timestamp with time zone,
     "created_by_id" text,
     "created_at" timestamp with time zone DEFAULT now() NOT NULL
   );`,
  // Redeeming a link looks the token up by hash; expiry sweeps scan by date.
  `CREATE INDEX IF NOT EXISTS "reset_tokens_user_idx" ON "password_reset_tokens" ("user_id");`,
  `CREATE INDEX IF NOT EXISTS "reset_tokens_expires_idx" ON "password_reset_tokens" ("expires_at");`,
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
