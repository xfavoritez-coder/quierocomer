import type { RecoveryConfig } from "@/lib/ecommerce/store-config";
import type { ClientRow } from "@/lib/ecommerce/client-segmentation";

export type RecoveryAutomation = "first_buyer" | "at_risk" | "abandonment_survey" | "recovery_incentive";

/** Días que deben pasar entre la encuesta ENVIADA y el cupón. */
export const COUPON_DAYS_AFTER_SURVEY = 7;

/** Días mínimos sin pedir para enviar la encuesta de abandono a este cliente. */
export function surveyMinDays(client: ClientRow, rc: RecoveryConfig): number {
  const freq = client.avgFrequencyDays;
  return Math.min(90, freq ? Math.max(rc.abandonmentSurvey.daysInactive, Math.round(freq * 2.5)) : rc.abandonmentSurvey.daysInactive);
}

type EnrollmentLike = { customerEmail: string; automation: string; status: string; sentAt: Date | null };

/** Índice del historial de envíos de recuperación (de TODA la marca).
 *  - `hasEnrollment`: automatizaciones ya hechas por cliente. Los envíos FALLIDOS no
 *    cuentan, así un cliente cuya encuesta falló vuelve a recibir la encuesta (no el cupón).
 *  - `surveySentAt`: fecha en que la encuesta se ENVIÓ de verdad (sentAt), requisito del cupón. */
export function indexEnrollments(enrollments: EnrollmentLike[], now = Date.now()) {
  const thirtyDaysAgo = now - 30 * 86400000;
  const hasEnrollment = new Set<string>();
  const surveySentAt = new Map<string, number>();
  const lastSent = new Map<string, number>();
  const sentLast30 = new Map<string, number>();
  for (const e of enrollments) {
    const em = e.customerEmail.toLowerCase();
    if (e.status !== "failed") hasEnrollment.add(`${em}::${e.automation}`);
    if (!e.sentAt) continue;
    const t = e.sentAt.getTime();
    if (e.automation === "abandonment_survey" && t < (surveySentAt.get(em) ?? Infinity)) surveySentAt.set(em, t);
    if (t > (lastSent.get(em) ?? 0)) lastSent.set(em, t);
    if (t > thirtyDaysAgo) sentLast30.set(em, (sentLast30.get(em) ?? 0) + 1);
  }
  return { hasEnrollment, surveySentAt, lastSent, sentLast30 };
}

export type EnrollmentIndex = ReturnType<typeof indexEnrollments>;

/** Decide qué automatización aplicar a un cliente (o null si ninguna).
 *  1. Encuesta: cliente perdido que lleva al menos surveyMinDays sin pedir.
 *  2. Cupón: SOLO si la encuesta se envió hace al menos 7 días y el cliente sigue perdido.
 *  Compartido entre el cron de envío y el panel (cola de pendientes). */
export function pickAutomation(
  client: ClientRow,
  rc: RecoveryConfig,
  email: string,
  idx: EnrollmentIndex,
  now = Date.now(),
): RecoveryAutomation | null {
  if (client.status !== "churned" || client.orders < 2) return null;

  // Encuesta de abandono
  if (rc.abandonmentSurvey.enabled && client.daysSinceLastOrder >= surveyMinDays(client, rc)) {
    if (!idx.hasEnrollment.has(`${email}::abandonment_survey`)) return "abandonment_survey";
  }
  // Cupón: 7 días después de la encuesta enviada
  const surveyAt = idx.surveySentAt.get(email);
  if (rc.recoveryIncentive.enabled && surveyAt && now - surveyAt >= COUPON_DAYS_AFTER_SURVEY * 86400000) {
    if (!idx.hasEnrollment.has(`${email}::recovery_incentive`)) return "recovery_incentive";
  }
  return null;
}
