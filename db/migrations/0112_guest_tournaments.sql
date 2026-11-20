-- Torneos de prueba sin cuenta (lib/tournaments/guest-server.ts). Se guardan
-- en el servidor para que tengan enlace de inscripción. Quien lo crea da un
-- correo; recibe un enlace secreto de edición (solo se guarda su hash). Sin
-- confirmar el correo no hay página pública. Se borran 30 días después del
-- torneo (cron /api/cron/guest-tournaments), salvo que pasen a una cuenta.
-- Idempotente.

-- Usuario de sistema que figura como creador de los torneos de prueba (las
-- tablas exigen un usuario). No es una cuenta: no tiene acceso.
INSERT INTO "users" ("id", "name", "email", "is_platform_account")
VALUES ('00000000-0000-4000-8000-00000000e5e5', 'Organización', 'torneos-prueba@tenplanner.invalid', true)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "guest_email" varchar(255);
--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "guest_name" varchar(120);
--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "guest_token_hash" varchar(64);
--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "guest_verified_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "guest_expires_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "guest_warned_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tournaments_guest_email_idx" ON "tournaments" ("guest_email") WHERE "guest_email" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tournaments_guest_expires_idx" ON "tournaments" ("guest_expires_at") WHERE "guest_expires_at" IS NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  -- Dueño: club, monitor o, ahora, invitado (sin club ni monitor, con correo).
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournaments_owner_chk')
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'tournaments_owner_chk'
         AND pg_get_constraintdef(oid) LIKE '%guest%'
     ) THEN
    ALTER TABLE "tournaments" DROP CONSTRAINT "tournaments_owner_chk";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournaments_owner_chk') THEN
    ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_owner_chk" CHECK (
      ("owner_type" = 'club' AND "club_id" IS NOT NULL)
      OR ("owner_type" = 'coach' AND "coach_id" IS NOT NULL AND "club_id" IS NULL)
      OR ("owner_type" = 'guest' AND "club_id" IS NULL AND "coach_id" IS NULL
          AND "guest_email" IS NOT NULL AND "guest_token_hash" IS NOT NULL)
    );
  END IF;
END $$;
