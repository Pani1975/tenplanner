-- Cierra la API de datos de Supabase (PostgREST/GraphQL) sobre el esquema
-- public. La aplicación accede a la base solo por su conexión propia (rol
-- postgres, Drizzle); el navegador usa Supabase solo para el acceso (auth) y
-- el almacenamiento (storage). Así, desde fuera no se puede listar la
-- estructura de la base ni llamar a sus funciones, y sus errores no revelan
-- nombres internos (informe de Solincan, 4.7).
-- Idempotente: REVOKE no falla si el permiso ya no existe.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- Las funciones propias (no las de extensiones) tampoco se pueden ejecutar
-- por el permiso PUBLIC que Postgres da por defecto.
DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', f);
  END LOOP;
END $$;

-- Lo que se cree a partir de ahora tampoco queda abierto.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
