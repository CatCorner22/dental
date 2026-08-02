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
     "action" text NOT NULL,
     "target" text,
     "detail" text
   );`
];
