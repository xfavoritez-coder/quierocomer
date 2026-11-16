-- ============================================================
-- POS QuieroComer — config server-authoritative:
--   "PosTable" / "PosSector" / "PosStaff"
-- Reemplaza el event-sourcing en Dexie/pos_events (que un wipe borraba).
-- Son TABLAS PRISMA (acceso solo server-side vía prisma.*), así que NO llevan
-- RLS ni grants anon ni realtime (a diferencia de pos_events).
--
-- Aplicar en prod de forma ADITIVA e IDEMPOTENTE (NUNCA `prisma db push`):
--   scripts/apply-pos-config-tables.ts  (o pegar en el SQL Editor de Supabase).
-- Columnas/tipos/nombres de índice calcados de lo que Prisma espera para los
-- modelos (TEXT/INTEGER/BOOLEAN/TIMESTAMP(3), PascalCase citado) → sin drift.
-- ============================================================

CREATE TABLE IF NOT EXISTS "PosTable" (
  "id"           TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "number"       INTEGER NOT NULL,
  "label"        TEXT,
  "sectorId"     TEXT,
  "x"            INTEGER NOT NULL DEFAULT 0,
  "y"            INTEGER NOT NULL DEFAULT 0,
  "active"       BOOLEAN NOT NULL DEFAULT true,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PosTable_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PosTable_restaurantId_active_idx"
  ON "PosTable" ("restaurantId", "active");

CREATE TABLE IF NOT EXISTS "PosSector" (
  "id"           TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "position"     INTEGER NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PosSector_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PosSector_restaurantId_idx"
  ON "PosSector" ("restaurantId");

CREATE TABLE IF NOT EXISTS "PosStaff" (
  "id"           TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "pinHash"      TEXT NOT NULL DEFAULT '',
  "role"         TEXT NOT NULL DEFAULT 'garzon',
  "active"       BOOLEAN NOT NULL DEFAULT true,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PosStaff_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PosStaff_restaurantId_active_idx"
  ON "PosStaff" ("restaurantId", "active");

-- Nota: el @updatedAt de Prisma lo setea el cliente Prisma en cada update; el
-- DEFAULT CURRENT_TIMESTAMP de arriba solo cubre el INSERT. Sin FK a Restaurant
-- (igual que PosShift/PosCashSession) para no acoplar borrados.
