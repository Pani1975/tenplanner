-- Perfil del jugador: independiente de su ficha de alumno en un club. Lo
-- edita el propio jugador y puede hacerlo público (/j/<slug>) si quiere.
-- La fecha de nacimiento nunca se publica: solo sirve para calcular la
-- categoría (lib/players/category.ts). Un menor no puede tener perfil
-- público (se comprueba en el servidor con la fecha de nacimiento).
-- Partidos: nombre del torneo y «Mostrar en mi perfil» (por defecto no).
-- El rival nunca sale en el perfil público.
-- Acceso solo desde el servidor; RLS activado sin políticas, como en torneos.
-- Idempotente: se puede aplicar más de una vez.
CREATE TABLE IF NOT EXISTS "player_profiles" (
  "user_id" uuid PRIMARY KEY NOT NULL,
  "first_name" varchar(80) NOT NULL,
  "last_name" varchar(120) NOT NULL,
  "birth_date" date,
  "show_photo" boolean DEFAULT false NOT NULL,
  "club_name" varchar(120),
  "dominant_hand" varchar(10),
  "favorite_shot" varchar(20),
  "started_age" smallint,
  "favorite_player" varchar(80),
  "birth_place" varchar(120),
  "is_public" boolean DEFAULT false NOT NULL,
  "slug" varchar(80),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "player_profiles" ADD CONSTRAINT "player_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "player_profiles_slug_uniq" ON "player_profiles" USING btree ("slug");
--> statement-breakpoint
ALTER TABLE "player_profiles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "tournament_name" varchar(120);
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "show_on_profile" boolean DEFAULT false NOT NULL;
