-- Añade la columna appOnly a Dish (productos exclusivos de la app).
-- Aditiva, idempotente y segura: no afecta filas ni código existente.
ALTER TABLE "Dish" ADD COLUMN IF NOT EXISTS "appOnly" BOOLEAN NOT NULL DEFAULT false;
