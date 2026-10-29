-- Objetivos técnicos de bola roja que no decían a qué golpe pertenecen.
-- Se antepone el golpe ("Saque:", "Remate:", "Volea:") para que el monitor
-- sepa qué se trabaja al buscar una clase. Mismo id: los logros se conservan.

UPDATE "tennis_objectives" SET "title" = 'Saque: lanza la pelota hacia arriba con una mano y la deja caer en un punto señalado' WHERE "code" = 'BR-TEC-SERVI-01' AND "club_id" IS NULL AND "coach_id" IS NULL AND "student_id" IS NULL;--> statement-breakpoint
UPDATE "tennis_objectives" SET "title" = 'Saque: lanza la pelota y la para con el centro de la raqueta' WHERE "code" = 'BR-TEC-SERVI-05' AND "club_id" IS NULL AND "coach_id" IS NULL AND "student_id" IS NULL;--> statement-breakpoint
UPDATE "tennis_objectives" SET "title" = 'Saque: golpea la pelota y pasa la red terminando el golpe' WHERE "code" = 'BR-TEC-SERVI-06' AND "club_id" IS NULL AND "coach_id" IS NULL AND "student_id" IS NULL;--> statement-breakpoint
UPDATE "tennis_objectives" SET "title" = 'Remate: recibe la pelota lanzada desde el otro lado con la mano no dominante, en posición de lado' WHERE "code" = 'BR-TEC-REMAT-01' AND "club_id" IS NULL AND "coach_id" IS NULL AND "student_id" IS NULL;--> statement-breakpoint
UPDATE "tennis_objectives" SET "title" = 'Remate: para la pelota con el centro de la raqueta por encima de la cabeza, en posición de lado' WHERE "code" = 'BR-TEC-REMAT-02' AND "club_id" IS NULL AND "coach_id" IS NULL AND "student_id" IS NULL;--> statement-breakpoint
UPDATE "tennis_objectives" SET "title" = 'Volea: toca la pelota sin bote cerca de la red con la raqueta por delante' WHERE "code" = 'BR-TEC-JUEGO-01' AND "club_id" IS NULL AND "coach_id" IS NULL AND "student_id" IS NULL;--> statement-breakpoint
UPDATE "tennis_objectives" SET "title" = 'Volea: mantiene la raqueta delante del cuerpo y la cabeza arriba al recibir la pelota sin bote' WHERE "code" = 'BR-TEC-VOLEA-02' AND "club_id" IS NULL AND "coach_id" IS NULL AND "student_id" IS NULL;
