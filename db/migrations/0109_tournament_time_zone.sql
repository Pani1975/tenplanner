-- Zona horaria del torneo: península y Baleares o Canarias. Con ella se
-- interpretan y muestran el plazo de inscripción y el orden de juego.
-- Idempotente.
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "time_zone" varchar(40) DEFAULT 'Europe/Madrid' NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournaments_time_zone_chk') THEN
    ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_time_zone_chk"
      CHECK ("time_zone" IN ('Europe/Madrid', 'Atlantic/Canary'));
  END IF;
END $$;
