-- Zona horaria del club (península y Baleares o Canarias). Con ella se
-- muestran y validan las Reservas de pistas, la reserva pública y, por
-- defecto, los torneos del club. Los clubes que ya existían quedan en
-- Canarias, que es la hora que usaban hasta ahora las Reservas de pistas;
-- cada club la cambia en «Mi club». Idempotente.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clubs' AND column_name = 'time_zone'
  ) THEN
    ALTER TABLE "clubs" ADD COLUMN "time_zone" varchar(40) DEFAULT 'Europe/Madrid' NOT NULL;
    UPDATE "clubs" SET "time_zone" = 'Atlantic/Canary';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clubs_time_zone_chk') THEN
    ALTER TABLE "clubs" ADD CONSTRAINT "clubs_time_zone_chk"
      CHECK ("time_zone" IN ('Europe/Madrid', 'Atlantic/Canary'));
  END IF;
END $$;
