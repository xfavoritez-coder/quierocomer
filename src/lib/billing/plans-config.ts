/**
 * Billing & Flow configuration.
 *
 * Plan definitions, prices, and features live in plans-central.ts.
 * This file adds Flow-specific billing config, vendor commissions,
 * and billing field validation on top of the central source.
 */
import {
  PLANS,
  PLAN_ORDER,
  PAID_PLANS,
  IVA_RATE,
  TRIAL_DAYS,
  GRACE_DAYS,
  ivaOf,
  grossOf,
  type PlanKey,
} from "./plans-central";

// Re-export central constants so existing consumers don't break
export { PLANS, PLAN_ORDER, PAID_PLANS, IVA_RATE, TRIAL_DAYS, GRACE_DAYS, ivaOf, grossOf };
export type { PlanKey };

// --- Flow billing plans ---

export type FlowPlanConfig = {
  planId: string;
  name: string;
  amountNet: number;
  appPlan: Exclude<PlanKey, "FREE">;
};

export const FLOW_PLANS: Record<Exclude<PlanKey, "FREE">, FlowPlanConfig> = {
  SILVER:  { planId: "qc_silver_monthly",  name: "QuieroComer Silver",  amountNet: PLANS.SILVER.priceMonthly,  appPlan: "SILVER" },
  GOLD:    { planId: "qc_gold_monthly",    name: "QuieroComer Gold",    amountNet: PLANS.GOLD.priceMonthly,    appPlan: "GOLD" },
  PREMIUM: { planId: "qc_premium_monthly", name: "QuieroComer Premium", amountNet: PLANS.PREMIUM.priceMonthly, appPlan: "PREMIUM" },
};

// Precio promocional para activacion desde demo (primer mes)
export const ACTIVATION_PROMO: Partial<Record<Exclude<PlanKey, "FREE">, { amountNet: number; label: string }>> = {
  PREMIUM: { amountNet: 4900, label: "$4.900 primer mes" },
};

export function activationPromoAmount(plan: Exclude<PlanKey, "FREE">): number | null {
  return ACTIVATION_PROMO[plan]?.amountNet ?? null;
}

export function planFromFlowId(planId: string): PlanKey | null {
  for (const cfg of Object.values(FLOW_PLANS)) {
    if (cfg.planId === planId) return cfg.appPlan;
  }
  return null;
}

// --- Display: textos visibles en landing y panel ---
// Now reads from plans-central. Re-exported for backward compatibility.

export type PlanFeatureItem = { text: string; tip: string };

export const PLAN_LABELS: Record<PlanKey, string> = Object.fromEntries(
  PLAN_ORDER.map((k) => [k, PLANS[k].label])
) as Record<PlanKey, string>;

export const PLAN_TAGLINES: Record<PlanKey, string> = Object.fromEntries(
  PLAN_ORDER.map((k) => [k, PLANS[k].tagline])
) as Record<PlanKey, string>;

export const PLAN_INHERITS_FROM: Partial<Record<PlanKey, string>> = Object.fromEntries(
  PLAN_ORDER.filter((k) => PLANS[k].inheritsFrom).map((k) => [k, PLANS[k].inheritsFrom!])
) as Partial<Record<PlanKey, string>>;

export const PLAN_FEATURES_DISPLAY: Record<PlanKey, PlanFeatureItem[]> = Object.fromEntries(
  PLAN_ORDER.map((k) => [k, PLANS[k].featureDisplay])
) as Record<PlanKey, PlanFeatureItem[]>;

/** Devuelve precio NETO mensual del plan. FREE = 0. */
export function planNetAmount(plan: PlanKey): number {
  return PLANS[plan].priceMonthly;
}

// --- Comisiones de vendedores ---

export const VENDOR_COMMISSION = {
  directFirstMonthRate: 1.0,
  directSecondMonthRate: 0.5,
  directAnnualMonths: 3,
  upgradeFromFreeRate: 0.5,
  freeAmount: 0,
} as const;

export function vendorCommissionDirect(plan: Exclude<PlanKey, "FREE">): {
  firstMonth: number;
  secondMonth: number;
  total: number;
} {
  const net = planNetAmount(plan);
  const firstMonth = Math.round(net * VENDOR_COMMISSION.directFirstMonthRate);
  const secondMonth = Math.round(net * VENDOR_COMMISSION.directSecondMonthRate);
  return { firstMonth, secondMonth, total: firstMonth + secondMonth };
}

export function vendorCommissionAnnual(plan: Exclude<PlanKey, "FREE">): number {
  return planNetAmount(plan) * VENDOR_COMMISSION.directAnnualMonths;
}

export function vendorCommissionUpgrade(plan: Exclude<PlanKey, "FREE">): number {
  return Math.round(planNetAmount(plan) * VENDOR_COMMISSION.upgradeFromFreeRate);
}

// --- Datos de facturacion ---

export const REQUIRED_BILLING_FIELDS = [
  "billingCompanyName",
  "billingRut",
  "billingGiro",
  "billingAddress",
  "billingCity",
  "billingEmail",
] as const;

export type RequiredBillingField = (typeof REQUIRED_BILLING_FIELDS)[number];

export function missingBillingFields(
  data: Partial<Record<RequiredBillingField, string | null | undefined>>,
): RequiredBillingField[] {
  return REQUIRED_BILLING_FIELDS.filter((f) => {
    const v = data[f];
    return !v || String(v).trim().length === 0;
  });
}

export function isValidRut(rut: string): boolean {
  if (!rut) return false;
  const clean = rut.replace(/[.\s]/g, "").replace(/-/g, "").toUpperCase();
  if (!/^[0-9]+[0-9K]$/.test(clean)) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  if (body.length < 7 || body.length > 8) return false;

  let sum = 0;
  let mult = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * mult;
    mult = mult === 7 ? 2 : mult + 1;
  }
  const mod = 11 - (sum % 11);
  const expected = mod === 11 ? "0" : mod === 10 ? "K" : String(mod);
  return expected === dv;
}

export function formatRut(rut: string): string {
  const clean = rut.replace(/[.\s-]/g, "").toUpperCase();
  if (clean.length < 2) return rut;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${formatted}-${dv}`;
}

// --- Precios anuales ---

/** Precio NETO mensualizado del plan anual. FREE = 0. */
export function planAnnualNetMonthly(plan: PlanKey): number {
  return PLANS[plan].priceAnnualMonthly;
}

/** Total NETO anual (mensualizado x 12). FREE = 0. */
export function planAnnualNetTotal(plan: PlanKey): number {
  return planAnnualNetMonthly(plan) * 12;
}
