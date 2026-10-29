ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "management_mode" boolean DEFAULT false NOT NULL;
