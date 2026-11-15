-- ============================================================
-- PROTECCIÓN de pos_events contra DROP accidental (prisma db push)
-- ------------------------------------------------------------
-- pos_events es una tabla RAW-SQL (no la administra Prisma, a propósito:
-- BIGSERIAL + JSONB + RLS + realtime, ver 001_pos_events.sql). El problema
-- recurrente: `prisma db push` contra prod DROPea toda tabla que no esté en
-- schema.prisma → borró pos_events 3 veces en nov-2026 (pérdida de cajas,
-- mesas y cuentas del POS). Meter un `model PosEvent` al schema NO es opción:
-- ya se intentó y Prisma creó una tabla vacía y borró la real.
--
-- Este EVENT TRIGGER ataca la causa raíz a nivel de BD: cualquier intento de
-- DROP de pos_events (venga de `prisma db push`, `migrate reset`, o un DROP
-- manual) lanza una excepción y hace ROLLBACK de TODA la operación. Los datos
-- quedan físicamente imposibles de borrar por accidente.
--
-- Supabase permite crear event triggers con el rol `postgres` (verificado,
-- aunque rolsuper=false).
--
-- OPERACIÓN LEGÍTIMA sobre la tabla (recrearla, migrarla, etc.):
--   DROP EVENT TRIGGER protect_raw_tables_drop;   -- quitar el candado
--   ... tus cambios ...
--   \i 002_protect_pos_events.sql                 -- volver a poner el candado
-- ============================================================

CREATE OR REPLACE FUNCTION protect_raw_tables_drop()
RETURNS event_trigger
LANGUAGE plpgsql
AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type = 'table'
       AND obj.schema_name = 'public'
       AND obj.object_name IN ('pos_events') THEN
      RAISE EXCEPTION
        'DROP de "%" BLOQUEADO: tabla protegida (event-store del POS, RAW-SQL no-Prisma). Casi siempre esto es un `prisma db push` contra prod. Para operar a propósito: DROP EVENT TRIGGER protect_raw_tables_drop; ...; y re-aplicar 002_protect_pos_events.sql.',
        obj.object_name;
    END IF;
  END LOOP;
END;
$$;

DROP EVENT TRIGGER IF EXISTS protect_raw_tables_drop;
CREATE EVENT TRIGGER protect_raw_tables_drop
  ON sql_drop
  EXECUTE FUNCTION protect_raw_tables_drop();
