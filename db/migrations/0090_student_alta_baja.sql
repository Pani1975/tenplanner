-- Alta y baja del alumno: cómo nos conoció (clave + detalle libre) y, si deja
-- la escuela, fecha de baja y motivo (clave + detalle libre). Ver
-- lib/students/membership.ts. Alimentan el informe de gestión.
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "how_found" varchar(40);
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "how_found_detail" varchar(255);
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "left_at" date;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "left_reason" varchar(40);
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "left_reason_detail" varchar(500);
