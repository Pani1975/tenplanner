-- Tipo de competición del ejercicio: individual y/o dobles (varias opciones).
-- Idempotente.
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "tipo_competicion" jsonb;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "exercises_tipo_competicion_gin_idx" ON "exercises" USING gin ("tipo_competicion");
