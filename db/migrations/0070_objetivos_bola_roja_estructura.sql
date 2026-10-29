-- Reestructura de objetivos de bola roja (catálogo base).
-- Cada golpe es una subcategoría (block); los pasos van de menor a mayor y el
-- último es el objetivo final (is_final). Saque, remate y volea quedan con sus
-- pasos. Los objetivos con logros de alumnos NO se borran: se ocultan.

ALTER TABLE "tennis_objectives" ADD COLUMN IF NOT EXISTS "is_final" boolean NOT NULL DEFAULT false;--> statement-breakpoint

-- 1) Borrar inactivos sin ningún logro de alumno.
DELETE FROM "tennis_objectives"
WHERE "code" IN ('BR-MEN-ACTIT-05', 'BR-MEN-DISCI-02', 'BR-TAC-PELOT-07')
  AND "ball" = 'roja' AND "club_id" IS NULL AND "coach_id" IS NULL AND "student_id" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "student_objectives" so WHERE so."objective_id" = "tennis_objectives"."id");--> statement-breakpoint

-- 2) Códigos TP-… a la convención BR-TEC-… (sin cambiar el id, así que los logros se conservan).
UPDATE "tennis_objectives" SET "code" = 'BR-TEC-DEREC-06' WHERE "code" = 'TP-184E1B82EB';--> statement-breakpoint
UPDATE "tennis_objectives" SET "code" = 'BR-TEC-DEREC-07' WHERE "code" = 'TP-F06A2AD03C';--> statement-breakpoint
UPDATE "tennis_objectives" SET "code" = 'BR-TEC-DEREC-08' WHERE "code" = 'TP-7E2CE3185A';--> statement-breakpoint
UPDATE "tennis_objectives" SET "code" = 'BR-TEC-REVES-04' WHERE "code" = 'TP-555056AF62';--> statement-breakpoint
UPDATE "tennis_objectives" SET "code" = 'BR-TEC-REVES-05' WHERE "code" = 'TP-C42C91D785';--> statement-breakpoint
UPDATE "tennis_objectives" SET "code" = 'BR-TEC-REVES-06' WHERE "code" = 'TP-94E7B2D71A';--> statement-breakpoint
UPDATE "tennis_objectives" SET "code" = 'BR-TEC-REVES-07' WHERE "code" = 'TP-A4A3164D7E';--> statement-breakpoint
UPDATE "tennis_objectives" SET "code" = 'BR-TEC-REVES-08' WHERE "code" = 'TP-B89E6F79B0';--> statement-breakpoint

-- 3) Corrección de textos.
-- Está en Derecha, pero decía "de revés".
UPDATE "tennis_objectives" SET "title" = 'Golpea la pelota por delante del cuerpo de derecha'
WHERE "code" = 'BR-TEC-DEREC-03';--> statement-breakpoint
-- Copia de la derecha dentro de Revés: se oculta (sin logros).
UPDATE "tennis_objectives" SET "is_active" = false WHERE "code" = 'BR-TEC-REVES-08';--> statement-breakpoint
UPDATE "tennis_objectives" SET "criterion" = 'Coge la raqueta siempre con la empuñadura continental en la mano dominante y este en la no dominante'
WHERE "code" = 'BR-TEC-REVES-05';--> statement-breakpoint
UPDATE "tennis_objectives" SET "criterion" = 'Para 4 de 5 pelotas con el centro de la raqueta'
WHERE "code" IN ('BR-TEC-DEREC-07', 'BR-TEC-REVES-06');--> statement-breakpoint

-- 4) Derecha: el final ya existe (BR-TEC-DEREC-08).
UPDATE "tennis_objectives" SET "is_final" = true WHERE "code" = 'BR-TEC-DEREC-08';--> statement-breakpoint

-- 5) Revés: nuevo objetivo final, simétrico con la derecha.
INSERT INTO "tennis_objectives" ("code","sport","ball","stage","age_range","aspect","block","title","criterion","source","sort_order","is_active","is_final")
VALUES ('BR-TEC-REVES-09','tenis','roja','Descubrimiento','4-6 años','tecnico','Revés',
  'Encadena golpes de revés con bucle en movimientos cortos sobre lanzamiento del monitor, dirigiendo la pelota',
  'Consigue 5 golpes seguidos dentro de la pista','desglose',24,true,true);--> statement-breakpoint

-- 6) Saque: paso 1 se mantiene (BR-TEC-SERVI-01); 2 y 3 se ocultan (tienen logros, se conservan);
-- se añaden los pasos nuevos y BR-TEC-SERVI-04 pasa a ser el final.
UPDATE "tennis_objectives" SET "is_active" = false WHERE "code" IN ('BR-TEC-SERVI-02', 'BR-TEC-SERVI-03');--> statement-breakpoint
UPDATE "tennis_objectives" SET "sort_order" = 19 WHERE "code" = 'BR-TEC-SERVI-01';--> statement-breakpoint
UPDATE "tennis_objectives" SET
  "title" = 'Desde la línea de saque, saca golpeando con el centro de la raqueta, terminando el golpe y dirigiendo la pelota al cuadro de saque correspondiente',
  "criterion" = 'Mete 4 de 10 saques en el cuadro de saque correspondiente',
  "sort_order" = 22,
  "is_final" = true
WHERE "code" = 'BR-TEC-SERVI-04';--> statement-breakpoint
INSERT INTO "tennis_objectives" ("code","sport","ball","stage","age_range","aspect","block","title","criterion","source","sort_order","is_active","is_final")
VALUES
  ('BR-TEC-SERVI-05','tenis','roja','Descubrimiento','4-6 años','tecnico','Servicio',
   'Lanza la pelota y la para con el centro de la raqueta','Para 4 de 5 pelotas con el centro de la raqueta','desglose',20,true,false),
  ('BR-TEC-SERVI-06','tenis','roja','Descubrimiento','4-6 años','tecnico','Servicio',
   'Golpea la pelota y pasa la red terminando el golpe','4 de 10 pelotas pasan la red con el golpe terminado','desglose',21,true,false);--> statement-breakpoint

-- 7) Remate: bloque nuevo, 4 pasos (el último es el final).
INSERT INTO "tennis_objectives" ("code","sport","ball","stage","age_range","aspect","block","title","criterion","source","sort_order","is_active","is_final")
VALUES
  ('BR-TEC-REMAT-01','tenis','roja','Descubrimiento','4-6 años','tecnico','Remate',
   'Recibe la pelota lanzada desde el otro lado con la mano no dominante, en posición de lado','La coge en 4 de 5 lanzamientos','desglose',1,true,false),
  ('BR-TEC-REMAT-02','tenis','roja','Descubrimiento','4-6 años','tecnico','Remate',
   'Para la pelota con el centro de la raqueta, en posición de lado','Para 4 de 5 pelotas con el centro de la raqueta','desglose',2,true,false),
  ('BR-TEC-REMAT-03','tenis','roja','Descubrimiento','4-6 años','tecnico','Remate',
   'Golpea la pelota alta por encima de la cabeza con gesto corto de remate, sobre lanzamiento del monitor desde la red','Envía 4 de 10 pelotas al campo contrario','desglose',3,true,false),
  ('BR-TEC-REMAT-04','tenis','roja','Descubrimiento','4-6 años','tecnico','Remate',
   'Remata sin desplazamiento, dirigiendo la pelota a una diana','Acierta la diana 3 de 5 veces','desglose',4,true,true);--> statement-breakpoint

-- 8) Volea: JUEGO-01 (paso 1, ya oculto con logros) se reactiva; se añaden 2 pasos y JUEGO-02 es el final.
UPDATE "tennis_objectives" SET "is_active" = true, "block" = 'Volea', "sort_order" = 22 WHERE "code" = 'BR-TEC-JUEGO-01';--> statement-breakpoint
UPDATE "tennis_objectives" SET "block" = 'Volea', "sort_order" = 25, "is_final" = true WHERE "code" = 'BR-TEC-JUEGO-02';--> statement-breakpoint
INSERT INTO "tennis_objectives" ("code","sport","ball","stage","age_range","aspect","block","title","criterion","source","sort_order","is_active","is_final")
VALUES
  ('BR-TEC-VOLEA-02','tenis','roja','Descubrimiento','4-6 años','tecnico','Volea',
   'Mantiene la raqueta delante del cuerpo y la cabeza arriba al recibir la pelota sin bote','Lo hace en 6 de 10 pelotas','desglose',23,true,false),
  ('BR-TEC-VOLEA-03','tenis','roja','Descubrimiento','4-6 años','tecnico','Volea',
   'Mantiene un intercambio de voleas cooperativo con el monitor o un compañero','3 golpes seguidos','desglose',24,true,false);--> statement-breakpoint

-- 9) Juego en red deja de existir como bloque (sus objetivos están en Volea).
-- Los objetivos de volea de otros ámbitos no se tocan: solo el catálogo base.
