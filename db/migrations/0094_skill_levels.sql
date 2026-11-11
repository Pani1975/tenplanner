-- F0.2 + F0.3 (docs/f1-plan.md, PR 1): escalera de niveles como dato,
-- nivel por defecto del grupo y limpieza de students.player_level.
-- Idempotente: se puede ejecutar más de una vez sin efectos nuevos.

-- 1. Escalera de niveles. `position` ordena dentro de (sport, track).
CREATE TABLE IF NOT EXISTS "skill_levels" (
  "code" varchar(32) PRIMARY KEY,
  "sport" "sport" NOT NULL DEFAULT 'tenis',
  "track" varchar(16) NOT NULL DEFAULT 'base',
  "position" smallint NOT NULL,
  "label_es" varchar(64) NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "skill_levels_sport_track_position_uniq" UNIQUE ("sport", "track", "position")
);
--> statement-breakpoint
-- Tenis (también la usan pickleball y tenis playa, como hoy en la app).
-- familiarizacion: la usan 10 ejercicios; no se ofrece en la ficha del alumno.
-- adultos_*: vía paralela de adultos. Pádel: su propia escala.
INSERT INTO "skill_levels" ("code", "sport", "track", "position", "label_es") VALUES
  ('familiarizacion',    'tenis', 'base',    1, 'Familiarización'),
  ('descubrimiento',     'tenis', 'base',    2, 'Descubrimiento'),
  ('desarrollo',         'tenis', 'base',    3, 'Desarrollo'),
  ('consolidacion',      'tenis', 'base',    4, 'Consolidación'),
  ('especializacion',    'tenis', 'base',    5, 'Especialización'),
  ('precompeticion',     'tenis', 'base',    6, 'Precompetición'),
  ('competicion',        'tenis', 'base',    7, 'Competición'),
  ('rendimiento',        'tenis', 'base',    8, 'Rendimiento'),
  ('adultos_iniciacion', 'tenis', 'adultos', 1, 'Adultos iniciación'),
  ('adultos_medio_alto', 'tenis', 'adultos', 2, 'Adultos medio-alto'),
  ('iniciacion',         'padel', 'base',    1, 'Iniciación'),
  ('medio',              'padel', 'base',    2, 'Medio'),
  ('avanzado',           'padel', 'base',    3, 'Avanzado')
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
-- Catálogo de solo lectura para todos; solo se cambia con migraciones.
ALTER TABLE "skill_levels" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "skill_levels_public_read" ON "skill_levels";
--> statement-breakpoint
CREATE POLICY "skill_levels_public_read" ON "skill_levels"
  FOR SELECT USING (true);
--> statement-breakpoint
-- Posición de un nivel en su escala (null si no existe), para comparar
-- niveles en SQL sin repetir un CASE.
CREATE OR REPLACE FUNCTION level_position(level_code text)
RETURNS smallint
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT "position" FROM skill_levels WHERE code = level_code;
$$;
--> statement-breakpoint

-- 2. Nivel por defecto del grupo (respaldo editable cuando los asistentes
-- no tienen nivel). null = sin definir.
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "default_level" varchar(32);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'groups_default_level_skill_levels_code_fk'
  ) THEN
    ALTER TABLE "groups"
      ADD CONSTRAINT "groups_default_level_skill_levels_code_fk"
      FOREIGN KEY ("default_level") REFERENCES "skill_levels"("code")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
--> statement-breakpoint

-- 3. Normalizar students.player_level (decisión de David, 2026-11-11).
-- Los nulos se quedan nulos.
UPDATE "students" SET "player_level" = 'desarrollo' WHERE "player_level" = 'intermediate';
--> statement-breakpoint
UPDATE "students" SET "player_level" = 'especializacion' WHERE "player_level" = 'advanced';
--> statement-breakpoint
-- Si queda algún valor fuera de la escala, la migración se detiene sin
-- inventar un nivel: hay que decidir a mano qué hacer con él.
DO $$
DECLARE
  invalid text;
BEGIN
  SELECT string_agg(DISTINCT s.player_level, ', ')
    INTO invalid
    FROM students s
   WHERE s.player_level IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM skill_levels l WHERE l.code = s.player_level);
  IF invalid IS NOT NULL THEN
    RAISE EXCEPTION 'students.player_level tiene valores fuera de skill_levels: %', invalid;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_player_level_skill_levels_code_fk'
  ) THEN
    ALTER TABLE "students"
      ADD CONSTRAINT "students_player_level_skill_levels_code_fk"
      FOREIGN KEY ("player_level") REFERENCES "skill_levels"("code")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
