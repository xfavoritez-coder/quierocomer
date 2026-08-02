-- Run this in Supabase SQL Editor
ALTER TABLE "RestaurantOwner" ADD COLUMN IF NOT EXISTS "emailVerificado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RestaurantOwner" ADD COLUMN IF NOT EXISTS "emailVerificadoAt" TIMESTAMP(3);
ALTER TABLE "PanelActivity" ADD COLUMN IF NOT EXISTS "ip" TEXT;
-- Mark all existing owners as already verified (they're real, existing customers)
UPDATE "RestaurantOwner" SET "emailVerificado" = true, "emailVerificadoAt" = NOW() WHERE "emailVerificado" = false;
