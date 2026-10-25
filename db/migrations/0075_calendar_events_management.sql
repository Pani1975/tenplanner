ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "management" boolean DEFAULT false NOT NULL;
