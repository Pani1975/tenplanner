-- Festivos del calendario: los crea el club (o un monitor, también en Modo Particular).
-- Rango de fechas (inclusive) sin hora. group_id NULL = afecta a todo el espacio
-- (todo el club, o todo el calendario particular); con group_id solo a ese grupo.
CREATE TABLE IF NOT EXISTS "calendar_holidays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"club_id" uuid REFERENCES "clubs"("id") ON DELETE set null,
	"group_id" uuid REFERENCES "groups"("id") ON DELETE cascade,
	"title" varchar(255) NOT NULL,
	"description" text,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_holidays_range_chk" CHECK ("end_date" >= "start_date")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_holidays_user_id_idx" ON "calendar_holidays" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_holidays_club_dates_idx" ON "calendar_holidays" ("club_id","start_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_holidays_group_id_idx" ON "calendar_holidays" ("group_id");--> statement-breakpoint
-- La app accede con Drizzle (conexión directa); sin políticas, la API pública de Supabase no ve la tabla.
ALTER TABLE "calendar_holidays" ENABLE ROW LEVEL SECURITY;
