-- Un ejercicio puede usarse en varias fases de la sesión (calentamiento,
-- parte principal, vuelta a la calma). `phase` se mantiene como la primera.
-- Idempotente.
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "fases" jsonb;--> statement-breakpoint
UPDATE "exercises" SET "fases" = jsonb_build_array("phase"::text) WHERE "fases" IS NULL AND "phase" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "exercises_fases_gin_idx" ON "exercises" USING gin ("fases");
