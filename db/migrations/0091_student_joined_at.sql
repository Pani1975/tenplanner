-- Fecha de alta del alumno, editable. Por defecto es la de creación de la
-- ficha; las fichas existentes se rellenan con su fecha de creación.
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "joined_at" date;
UPDATE "students"
  SET "joined_at" = ("created_at" AT TIME ZONE 'Atlantic/Canary')::date
  WHERE "joined_at" IS NULL;
ALTER TABLE "students" ALTER COLUMN "joined_at" SET DEFAULT CURRENT_DATE;
ALTER TABLE "students" ALTER COLUMN "joined_at" SET NOT NULL;
