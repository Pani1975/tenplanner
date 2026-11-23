-- Mis partidos: solo tres tipos (decisión de David, 2026-11-23):
-- Torneo federado, Torneo no federado y Entrenamiento.
-- - 'torneo' pasa a 'torneo_federado' y 'amistoso' a 'torneo_no_federado'
--   (se renombra el valor: las filas existentes se conservan).
-- - Los 'partido_oficial' pasan a 'torneo_federado'. El valor queda en el
--   tipo sin uso (Postgres no borra valores de un enum sin recrearlo).
-- Idempotente: se puede aplicar más de una vez.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
             WHERE t.typname = 'match_type' AND e.enumlabel = 'torneo') THEN
    ALTER TYPE "match_type" RENAME VALUE 'torneo' TO 'torneo_federado';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
             WHERE t.typname = 'match_type' AND e.enumlabel = 'amistoso') THEN
    ALTER TYPE "match_type" RENAME VALUE 'amistoso' TO 'torneo_no_federado';
  END IF;
END $$;
--> statement-breakpoint
UPDATE "matches" SET "match_type" = 'torneo_federado' WHERE "match_type" = 'partido_oficial';
