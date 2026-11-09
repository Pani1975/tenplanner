-- Reserva pública de pistas: enlace público por dueño, pistas reservables
-- con horario y tabla de reservas (sin cuenta: solo nombre y apellidos).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "booking_token" varchar(40);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_booking_token_unique" ON "users" ("booking_token");
--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN IF NOT EXISTS "booking_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN IF NOT EXISTS "booking_open_minute" integer DEFAULT 480 NOT NULL;
--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN IF NOT EXISTS "booking_close_minute" integer DEFAULT 1320 NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "court_bookings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "place_id" uuid NOT NULL REFERENCES "places"("id") ON DELETE CASCADE,
  "owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "start_at" timestamp with time zone NOT NULL,
  "duration_minutes" integer NOT NULL,
  "full_name" varchar(120) NOT NULL,
  "cancelled_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "court_bookings_place_start_idx" ON "court_bookings" ("place_id", "start_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "court_bookings_owner_start_idx" ON "court_bookings" ("owner_id", "start_at");
--> statement-breakpoint
-- Los nombres solo se leen desde el servidor: sin acceso por la API pública.
ALTER TABLE "court_bookings" ENABLE ROW LEVEL SECURITY;
