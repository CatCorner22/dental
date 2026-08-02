CREATE TYPE "public"."role" AS ENUM('readonly', 'user', 'admin');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"target" text,
	"detail" text
);
--> statement-breakpoint
CREATE TABLE "drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"title" text DEFAULT 'Untitled note' NOT NULL,
	"note_state" jsonb NOT NULL,
	"status" text DEFAULT 'unfinished' NOT NULL,
	"last_send_failed" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"draft_id" text NOT NULL,
	"submitted_by_id" text NOT NULL,
	"submitted_by_name" text NOT NULL,
	"submitted_at_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at_et" text NOT NULL,
	"filename" text NOT NULL,
	"format" text NOT NULL,
	"rule_version" text NOT NULL,
	"audit_status" text NOT NULL,
	"note_markdown" text NOT NULL,
	"audit_report" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"role" "role" DEFAULT 'user' NOT NULL,
	"pass_hash" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"notice_ack_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;