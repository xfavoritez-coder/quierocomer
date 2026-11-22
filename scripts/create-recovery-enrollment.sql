-- Tabla para Recuperación Inteligente: enrollments de clientes en automatizaciones
CREATE TABLE IF NOT EXISTS "RecoveryEnrollment" (
  "id"                 TEXT PRIMARY KEY,
  "restaurantId"       TEXT NOT NULL REFERENCES "Restaurant"("id") ON DELETE CASCADE,
  "customerEmail"      TEXT NOT NULL,
  "customerPhone"      TEXT,
  "customerName"       TEXT,
  "automation"         TEXT NOT NULL,
  "status"             TEXT NOT NULL DEFAULT 'pending',
  "emailLogId"         TEXT,
  "couponCode"         TEXT,
  "scheduledFor"       TIMESTAMPTZ,
  "sentAt"             TIMESTAMPTZ,
  "openedAt"           TIMESTAMPTZ,
  "clickedAt"          TIMESTAMPTZ,
  "convertedAt"        TIMESTAMPTZ,
  "convertedOrderId"   TEXT,
  "surveyReason"       TEXT,
  "surveyDetail"       TEXT,
  "surveyComment"      TEXT,
  "surveyAnsweredAt"   TIMESTAMPTZ,
  "contextJson"        JSONB,
  "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "RecoveryEnrollment_restaurantId_idx" ON "RecoveryEnrollment"("restaurantId");
CREATE INDEX IF NOT EXISTS "RecoveryEnrollment_restaurantId_automation_idx" ON "RecoveryEnrollment"("restaurantId", "automation");
CREATE INDEX IF NOT EXISTS "RecoveryEnrollment_customerEmail_idx" ON "RecoveryEnrollment"("customerEmail");
CREATE INDEX IF NOT EXISTS "RecoveryEnrollment_status_scheduledFor_idx" ON "RecoveryEnrollment"("status", "scheduledFor");
CREATE INDEX IF NOT EXISTS "RecoveryEnrollment_restaurantId_createdAt_idx" ON "RecoveryEnrollment"("restaurantId", "createdAt");
