-- Mis partidos: ronda del partido (final, semifinal…) para el palmarés
-- público (/j/<slug>). Opcional; el valor son códigos de lib/matches/rounds.ts
-- o, con "otra", el texto libre de round_other.
-- Idempotente: se puede aplicar más de una vez.
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "round" varchar(20);
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "round_other" varchar(60);
