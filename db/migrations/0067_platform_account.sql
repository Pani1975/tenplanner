ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_platform_account" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Sustituye al "Modo Ten Planner" elegible por administradores (0066).
ALTER TABLE "users" DROP COLUMN IF EXISTS "ten_planner_mode";
