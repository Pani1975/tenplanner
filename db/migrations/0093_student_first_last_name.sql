-- Nombre y apellidos del alumno por separado. students.name sigue guardando
-- el nombre completo (lo usan listas, informes y PDF) y la aplicación lo
-- mantiene al día. Las fichas existentes se separan con la misma regla que
-- lib/students/names.ts: los dos últimos apellidos (con "de", "del", "de la"…)
-- son los apellidos; con dos palabras, la segunda.
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "first_name" varchar(255);
--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "last_name" varchar(255);
--> statement-breakpoint
UPDATE "students" s
SET
  "first_name" = coalesce(m3[1], m2[1], trimmed),
  "last_name" = coalesce(m3[2], m2[2])
FROM (
  SELECT id,
    regexp_replace(trim("name"), '\s+', ' ', 'g') AS trimmed,
    regexp_match(regexp_replace(trim("name"), '\s+', ' ', 'g'),
      '^(.+?)\s+((?:(?:de|del|la|las|los|san)\s+)*\S+\s+(?:(?:de|del|la|las|los|san)\s+)*\S+)$', 'i') AS m3,
    regexp_match(regexp_replace(trim("name"), '\s+', ' ', 'g'), '^(\S+)\s+(.+)$') AS m2
  FROM "students"
) x
WHERE s.id = x.id AND s."first_name" IS NULL;
