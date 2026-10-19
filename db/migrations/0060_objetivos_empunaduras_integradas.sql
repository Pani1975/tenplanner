-- Las empuñaduras dejan de ser un bloque aparte: se integran en el criterio de cada golpe.
-- Los 8 objetivos del bloque "Empuñaduras" se desactivan (no se borran, para conservar las marcas de los alumnos).
UPDATE "tennis_objectives" SET "is_active" = false WHERE "block" = 'Empuñaduras' AND "sport" = 'tenis';--> statement-breakpoint
UPDATE "tennis_objectives" AS o SET "criterion" = o."criterion" || v.extra
FROM (VALUES
  ('BR-TEC-DEREC-04', ', con la empuñadura "este suave"'),
  ('BN-TEC-DEREC-03', ', con la empuñadura "este suave" mantenida en todo el golpe'),
  ('BN-TEC-REVES-02', ', con las dos manos bien colocadas en la raqueta'),
  ('BN-TEC-SERVI-04', ', con la empuñadura continental'),
  ('BV-TEC-DEREC-01', ', con la empuñadura correcta en cualquier situación de juego'),
  ('BV-TEC-REVES-01', ', con la empuñadura correcta y cambio rápido entre derecha y revés'),
  ('BV-TEC-SERVI-01', ', con la empuñadura continental'),
  ('BV-TEC-VOLEA-01', ', con la empuñadura continental'),
  ('BV-TEC-VOLEA-02', ', con la empuñadura continental')
) AS v(code, extra)
WHERE o."code" = v.code AND o."criterion" NOT LIKE '%' || 'empuñadura' || '%' AND o."criterion" NOT LIKE '%dos manos bien colocadas%';
