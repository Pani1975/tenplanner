ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "coach_comment" text;
--> statement-breakpoint
ALTER TABLE "session_block_items" ADD COLUMN IF NOT EXISTS "coach_comment" text;
