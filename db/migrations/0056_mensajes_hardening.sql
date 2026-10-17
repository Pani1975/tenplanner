-- Ajustes de seguridad tras el análisis de Supabase (aplicado en producción el 2026-10-17)
ALTER FUNCTION public.lock_reply_columns() SET search_path = public;--> statement-breakpoint
ALTER FUNCTION public.lock_announcement_author() SET search_path = public;--> statement-breakpoint
-- Funciones de trigger: no deben poder llamarse desde la API
REVOKE EXECUTE ON FUNCTION public.lock_reply_columns(), public.lock_announcement_author(), public.check_guardian_relationship() FROM PUBLIC, anon, authenticated;
