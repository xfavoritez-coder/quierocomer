-- ============================================================
-- POS QuieroComer — tabla pos_events (event sourcing)
-- Ejecutar en Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS pos_events (
  server_seq  BIGSERIAL PRIMARY KEY,
  event_id    UUID NOT NULL UNIQUE,
  device_id   TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  restaurant_id TEXT NOT NULL REFERENCES "Restaurant"(id) ON DELETE CASCADE,
  created_at_local TIMESTAMPTZ NOT NULL,
  type        TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para sync pull (por restaurante + cursor)
CREATE INDEX IF NOT EXISTS idx_pos_events_restaurant_seq
  ON pos_events (restaurant_id, server_seq);

-- Índice para queries por tipo
CREATE INDEX IF NOT EXISTS idx_pos_events_restaurant_type
  ON pos_events (restaurant_id, type);

-- Índice para queries por cuenta (payload->account_id)
CREATE INDEX IF NOT EXISTS idx_pos_events_account
  ON pos_events ((payload->>'account_id'))
  WHERE payload->>'account_id' IS NOT NULL;

-- ============================================================
-- RLS: solo el dueño del restaurante puede leer/escribir
-- ============================================================

ALTER TABLE pos_events ENABLE ROW LEVEL SECURITY;

-- Policy: los eventos se insertan via service role o anon con restaurant_id validado
-- Por ahora permitimos insert/select para todos los autenticados del mismo restaurante
CREATE POLICY "pos_events_select" ON pos_events
  FOR SELECT USING (true);

CREATE POLICY "pos_events_insert" ON pos_events
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- Realtime: habilitar para sync multi-dispositivo
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE pos_events;

-- ============================================================
-- Notas:
-- - server_seq es BIGSERIAL: se autoincrementa al INSERT
-- - event_id es UNIQUE: el upsert idempotente del cliente usa ON CONFLICT
-- - El payload es JSONB para flexibilidad de los distintos tipos de evento
-- - RLS abierto por ahora, se ajustará cuando haya auth de staff
-- ============================================================
