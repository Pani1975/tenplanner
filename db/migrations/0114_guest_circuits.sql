-- Circuitos en el modo prueba (sin cuenta): un circuito de invitado no tiene
-- club ni monitor; se gestiona con el enlace de edición de sus torneos.
-- Idempotente.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tournament_circuits_owner_chk'
      AND pg_get_constraintdef(oid) NOT LIKE '%guest%'
  ) THEN
    ALTER TABLE "tournament_circuits" DROP CONSTRAINT "tournament_circuits_owner_chk";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_circuits_owner_chk') THEN
    ALTER TABLE "tournament_circuits" ADD CONSTRAINT "tournament_circuits_owner_chk" CHECK (
      ("owner_type" = 'club' AND "club_id" IS NOT NULL)
      OR ("owner_type" = 'coach' AND "coach_id" IS NOT NULL AND "club_id" IS NULL)
      OR ("owner_type" = 'guest' AND "club_id" IS NULL AND "coach_id" IS NULL)
    );
  END IF;
END $$;
--> statement-breakpoint
-- Categoría del torneo (Benjamín, Alevín… +60 u otra que escriba el
-- organizador). Sustituye al nivel en la gestión y en la página pública.
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "category" varchar(60);
