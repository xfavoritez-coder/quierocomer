/**
 * Configuracion de los 3 planes pagos de QuieroComer en Flow.
 * Los planIds se usan tanto en Flow como en nuestra DB para identificar el plan.
 */
import type { RestaurantPlan } from "@prisma/client";

export const TRIAL_DAYS = 7;
export const GRACE_DAYS = 7;

export type FlowPlanConfig = {
  planId: string;          // identificador unico en Flow
  name: string;            // nombre que ve el comercio
  amount: number;          // CLP, neto
  appPlan: Exclude<RestaurantPlan, "FREE">; // FREE no se cobra
};

// Solo planes pagos. FREE es el default gratuito sin Flow.
export const FLOW_PLANS: Record<Exclude<RestaurantPlan, "FREE">, FlowPlanConfig> = {
  GOLD:    { planId: "qc_gold_monthly",    name: "QuieroComer Gold",    amount: 29900, appPlan: "GOLD" },
  PREMIUM: { planId: "qc_premium_monthly", name: "QuieroComer Premium", amount: 49900, appPlan: "PREMIUM" },
};

export function planFromFlowId(planId: string): RestaurantPlan | null {
  for (const cfg of Object.values(FLOW_PLANS)) {
    if (cfg.planId === planId) return cfg.appPlan;
  }
  return null;
}
