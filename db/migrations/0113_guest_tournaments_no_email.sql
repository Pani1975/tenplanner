-- Torneos de prueba sin correo: al crearlos se genera un enlace secreto de
-- edición y un enlace público; el correo deja de ser obligatorio.
-- Idempotente.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tournaments_owner_chk'
      AND pg_get_constraintdef(oid) LIKE '%guest_email%'
  ) THEN
    ALTER TABLE "tournaments" DROP CONSTRAINT "tournaments_owner_chk";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournaments_owner_chk') THEN
    ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_owner_chk" CHECK (
      ("owner_type" = 'club' AND "club_id" IS NOT NULL)
      OR ("owner_type" = 'coach' AND "coach_id" IS NOT NULL AND "club_id" IS NULL)
      OR ("owner_type" = 'guest' AND "club_id" IS NULL AND "coach_id" IS NULL
          AND "guest_token_hash" IS NOT NULL)
    );
  END IF;
END $$;
--> statement-breakpoint
-- Sin confirmación por correo: los torneos de prueba ya creados quedan con
-- su página pública activa (si no están en borrador).
UPDATE "tournaments" SET "guest_verified_at" = COALESCE("guest_verified_at", "created_at")
WHERE "owner_type" = 'guest' AND "guest_verified_at" IS NULL;
