-- QuieroComer Ventas (/ventas): vendedores, campos de venta en Lead, eventos y registro del dueño.
-- Aditiva e idempotente: se puede ejecutar más de una vez y no modifica datos existentes.
-- Ejecutar en Supabase → SQL Editor ANTES de desplegar el código que usa estas columnas.

BEGIN;

-- Rol de vendedor
DO $$ BEGIN
  CREATE TYPE "SellerRole" AS ENUM ('ADMIN', 'SELLER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Vendedores (login por enlace de un solo uso enviado al correo)
CREATE TABLE IF NOT EXISTS "Seller" (
  "id"                  TEXT PRIMARY KEY,
  "email"               TEXT NOT NULL,
  "name"                TEXT NOT NULL,
  "role"                "SellerRole" NOT NULL DEFAULT 'SELLER',
  "active"              BOOLEAN NOT NULL DEFAULT true,
  "loginTokenHash"      TEXT,
  "loginTokenExpiresAt" TIMESTAMP(3),
  "lastLoginAt"         TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Seller_email_key" ON "Seller"("email");

-- Lead: campos de venta en terreno
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "sellerId"        TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "captureSource"   TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "cuisine"         TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "commune"         TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "interestModules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "recommendedPlan" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "lostReason"      TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "expiresAt"       TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Lead_sellerId_idx" ON "Lead"("sellerId");
DO $$ BEGIN
  ALTER TABLE "Lead" ADD CONSTRAINT "Lead_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Eventos de cada lead (historial / tracking de la demo)
CREATE TABLE IF NOT EXISTS "LeadEvent" (
  "id"         TEXT PRIMARY KEY,
  "leadId"     TEXT NOT NULL,
  "type"       TEXT NOT NULL,
  "chapter"    TEXT,
  "durationMs" INTEGER,
  "payload"    JSONB,
  "actor"      TEXT NOT NULL,
  "sellerId"   TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "LeadEvent_leadId_createdAt_idx" ON "LeadEvent"("leadId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "LeadEvent" ADD CONSTRAINT "LeadEvent_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Registro del dueño (/alta/[token])
CREATE TABLE IF NOT EXISTS "LeadRegistration" (
  "id"          TEXT PRIMARY KEY,
  "leadId"      TEXT NOT NULL,
  "tokenHash"   TEXT NOT NULL,
  "expiresAt"   TIMESTAMP(3) NOT NULL,
  "sentTo"      TEXT,
  "formData"    JSONB,
  "completedAt" TIMESTAMP(3),
  "remindedAt"  TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "LeadRegistration_leadId_key" ON "LeadRegistration"("leadId");
CREATE UNIQUE INDEX IF NOT EXISTS "LeadRegistration_tokenHash_key" ON "LeadRegistration"("tokenHash");
DO $$ BEGIN
  ALTER TABLE "LeadRegistration" ADD CONSTRAINT "LeadRegistration_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Las tablas nuevas no se exponen por la API pública de Supabase (solo el servidor las usa).
ALTER TABLE "Seller" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeadEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeadRegistration" ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Primer administrador (cambia el correo y el nombre si corresponde):
-- INSERT INTO "Seller" ("id", "email", "name", "role")
-- VALUES ('seller_admin_jaime', 'TU_CORREO@ejemplo.cl', 'Jaime', 'ADMIN')
-- ON CONFLICT ("email") DO NOTHING;
