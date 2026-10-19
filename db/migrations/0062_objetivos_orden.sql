-- Orden personalizable: un club, monitor o alumno puede cambiar la posición de un
-- objetivo dentro de su grupo. Idempotente.
ALTER TABLE "objective_overrides" ADD COLUMN IF NOT EXISTS "sort_order" integer;
