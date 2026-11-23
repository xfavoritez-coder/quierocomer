import type { RecoveryConfig } from "@/lib/ecommerce/store-config";
import type { ClientRow } from "@/lib/ecommerce/client-segmentation";

export type RecoveryAutomation = "first_buyer" | "at_risk" | "abandonment_survey" | "recovery_incentive";

/** Días mínimos sin pedir para enviar la encuesta de abandono a este cliente. */
export function surveyMinDays(client: ClientRow, rc: RecoveryConfig): number {
  const freq = client.avgFrequencyDays;
  return Math.min(90, freq ? Math.max(rc.abandonmentSurvey.daysInactive, Math.round(freq * 2.5)) : rc.abandonmentSurvey.daysInactive);
}

/** Días mínimos sin pedir para enviar el cupón de recuperación a este cliente. */
export function incentiveMinDays(client: ClientRow, rc: RecoveryConfig): number {
  const freq = client.avgFrequencyDays;
  return Math.min(120, freq ? Math.max(rc.recoveryIncentive.daysInactive, Math.round(freq * 3)) : rc.recoveryIncentive.daysInactive);
}

/** Decide qué automatización aplicar a un cliente (o null si ninguna).
 *  Respeta la frecuencia natural del cliente: solo contactar si lleva al menos
 *  2.5x su frecuencia habitual (mínimo el umbral de config, tope 90 días).
 *  Compartido entre el cron de envío y el panel (cola de pendientes). */
export function pickAutomation(
  client: ClientRow,
  rc: RecoveryConfig,
  email: string,
  hasEnrollment: Set<string>,
  hasAbandonment: Set<string>,
): RecoveryAutomation | null {
  // Encuesta de abandono
  if (rc.abandonmentSurvey.enabled && client.status === "churned" && client.daysSinceLastOrder >= surveyMinDays(client, rc) && client.orders >= 2) {
    if (!hasEnrollment.has(`${email}::abandonment_survey`)) return "abandonment_survey";
  }
  // Incentivo de recuperación
  if (rc.recoveryIncentive.enabled && client.status === "churned" && client.daysSinceLastOrder >= incentiveMinDays(client, rc) && client.orders >= 2) {
    if (hasAbandonment.has(email) && !hasEnrollment.has(`${email}::recovery_incentive`)) return "recovery_incentive";
  }
  return null;
}
