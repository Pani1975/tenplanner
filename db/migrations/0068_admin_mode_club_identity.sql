ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "admin_mode" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "full_name" varchar(255);--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "address" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "courts" jsonb;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "founded_year" integer;
