/**
 * Configuracion de los 3 planes pagos de QuieroComer en Flow.
 * Los planIds se usan tanto en Flow como en nuestra DB para identificar el plan.
 *
 * IVA: los precios se almacenan en valor NETO. El cobro mensual incluye 19% IVA,
 * por lo que el monto que se cobra via Flow (y que debe estar configurado en
 * el dashboard de Flow para cada planId) es el monto BRUTO = neto * 1.19.
 *
 * Para sincronizar los precios brutos en Flow, ejecuta:
 *   npx tsx scripts/setup-flow-plans.ts
 */
import type { RestaurantPlan } from "@prisma/client";

export const TRIAL_DAYS = 7;
export const GRACE_DAYS = 7;

export const IVA_RATE = 0.19;

/** IVA en CLP enteros, redondeado al peso. */
export function ivaOf(amountNet: number): number {
  return Math.round(amountNet * IVA_RATE);
}

/** Monto bruto (neto + IVA) en CLP enteros. */
export function grossOf(amountNet: number): number {
  return amountNet + ivaOf(amountNet);
}

export type FlowPlanConfig = {
  planId: string;          // identificador unico en Flow
  name: string;            // nombre que ve el comercio
  amountNet: number;       // CLP, neto (sin IVA)
  appPlan: Exclude<RestaurantPlan, "FREE">; // FREE no se cobra
};

// Solo planes pagos. FREE es el default gratuito sin Flow.
export const FLOW_PLANS: Record<Exclude<RestaurantPlan, "FREE">, FlowPlanConfig> = {
  GOLD:    { planId: "qc_gold_monthly",    name: "QuieroComer Gold",    amountNet: 35000, appPlan: "GOLD" },
  PREMIUM: { planId: "qc_premium_monthly", name: "QuieroComer Premium", amountNet: 49900, appPlan: "PREMIUM" },
};

export function planFromFlowId(planId: string): RestaurantPlan | null {
  for (const cfg of Object.values(FLOW_PLANS)) {
    if (cfg.planId === planId) return cfg.appPlan;
  }
  return null;
}

// ─── Display: textos visibles en landing y panel ───────────────────────
// Single source of truth para precios + features + taglines.
// Todos los componentes (LandingClient, PlanModal,
// suscripcion page) deben leer de aqui. No duplicar.

export type PlanKey = "FREE" | "GOLD" | "PREMIUM";

export type PlanFeatureItem = { text: string; tip: string };

export const PLAN_LABELS: Record<PlanKey, string> = {
  FREE: "Gratis",
  GOLD: "Gold",
  PREMIUM: "Premium",
};

export const PLAN_TAGLINES: Record<PlanKey, string> = {
  FREE: "Carta digital con QR para empezar a vender",
  GOLD: "Para destacar tus platos y entender a tus clientes",
  PREMIUM: "Para vender mas sin levantar un dedo",
};

/** Texto que se muestra como primer feature al heredar todo del plan inferior. */
export const PLAN_INHERITS_FROM: Record<Exclude<PlanKey, "FREE">, string> = {
  GOLD: "Todo lo del plan Gratis",
  PREMIUM: "Todo del plan Gold",
};

export const PLAN_FEATURES_DISPLAY: Record<PlanKey, PlanFeatureItem[]> = {
  FREE: [
    { text: "Carta QR digital", tip: "Tus clientes escanean un QR y ven tu carta al instante. Sin app, sin descargas." },
    { text: "Vista lista", tip: "Todos los platos en una lista atractiva y facil de navegar. Cuando el cliente toca un plato, se abre un detalle con foto grande y descripcion del producto." },
    { text: "Panel autoadministrable", tip: "Editas tu carta cuando quieras desde tu celular o computador: precios, fotos, descripciones, modificadores. Los cambios se ven al instante." },
  ],
  GOLD: [
    { text: "El Genio incluido 🧞", tip: "El Genio reordena tu carta segun los gustos de cada cliente: dieta, restricciones y alergenos." },
    { text: "2 vistas de carta", tip: "Vista lista y vista galeria con fotos grandes." },
    { text: "Destaca platos estrella", tip: "Marca tus platos mas vendidos para que aparezcan primero en el hero." },
    { text: "Ofertas y promociones", tip: "Publica descuentos que se muestran automaticamente en la carta." },
    { text: "Estadisticas basicas", tip: "Visitantes, sesiones, platos mas vistos y duracion promedio." },
    { text: "Anuncios en la carta", tip: "Banner de novedades visible al abrir la carta." },
    { text: "Multilenguaje (ES · EN · PT)", tip: "Carta traducida automaticamente al idioma del cliente." },
  ],
  PREMIUM: [
    { text: "4 vistas de carta", tip: "Lista, galeria, feed y espacial — elige la que mejor represente tu local." },
    { text: "Estadisticas avanzadas", tip: "Sesiones en vivo, recorrido de cada cliente, busquedas y estadisticas del garzon." },
    { text: "Llamar al garzon", tip: "El cliente toca un boton y el garzon recibe la notificacion push al instante." },
    { text: "Productos sugeridos", tip: "El Genio sugiere acompañamientos para subir el ticket de cada mesa." },
    { text: "Automatizaciones", tip: "Emails automaticos: bienvenida, cumpleaños y reactivacion de clientes inactivos." },
    { text: "Campañas y email marketing", tip: "Envia comunicaciones masivas a tus clientes registrados." },
    { text: "Clientes ilimitados + CSV", tip: "Ve todos los registrados y exporta la lista." },
    { text: "Integracion con Toteat", tip: "Sincronizamos ventas reales con la carta. Dashboard en vivo y badges como 'lo mas pedido hoy'." },
  ],
};

/** Devuelve precio NETO mensual del plan. FREE = 0. */
export function planNetAmount(plan: PlanKey): number {
  if (plan === "FREE") return 0;
  return FLOW_PLANS[plan].amountNet;
}

// ─── Comisiones de vendedores ──────────────────────────────────────────
// Single source of truth para comisiones del programa de vendedores.
// Se calculan sobre el precio NETO del plan.
//
// Reglas:
// - Plan Gratis: sin comision.
// - Cliente entra DIRECTO mensual a Gold/Premium: 100% del primer mes + 50% del segundo.
// - Cliente entra DIRECTO anual a Gold/Premium: 3 meses del precio mensual.
// - Cliente entra Gratis y luego hace UPGRADE a Gold/Premium: 50% del plan, una vez.

export const VENDOR_COMMISSION = {
  /** Fraccion del plan neto pagada al vendedor por cierre directo mensual, mes 1. */
  directFirstMonthRate: 1.0,
  /** Fraccion del plan neto pagada al vendedor por cierre directo mensual, mes 2. */
  directSecondMonthRate: 0.5,
  /** Meses del precio mensual pagados al vendedor por cierre directo anual. */
  directAnnualMonths: 3,
  /** Fraccion del plan neto pagada al vendedor cuando un cliente Gratis hace upgrade. */
  upgradeFromFreeRate: 0.5,
  /** Comision en CLP cuando el cierre fue en plan Gratis. */
  freeAmount: 0,
} as const;

/** Comision por cerrar un cliente directo en plan mensual. */
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

/** Comision por cerrar un cliente directo en plan anual. */
export function vendorCommissionAnnual(plan: Exclude<PlanKey, "FREE">): number {
  return planNetAmount(plan) * VENDOR_COMMISSION.directAnnualMonths;
}

/** Comision por upgrade desde Gratis hacia un plan pago. Pago unico. */
export function vendorCommissionUpgrade(plan: Exclude<PlanKey, "FREE">): number {
  return Math.round(planNetAmount(plan) * VENDOR_COMMISSION.upgradeFromFreeRate);
}

// ─── Datos de facturacion ──────────────────────────────────────────────

/** Lista de campos de facturacion requeridos para emitir factura electronica. */
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

/** Valida formato de RUT chileno (con dv, con o sin puntos/guion). */
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

/** Formatea RUT en formato chileno estandar: 12.345.678-9 */
export function formatRut(rut: string): string {
  const clean = rut.replace(/[.\s-]/g, "").toUpperCase();
  if (clean.length < 2) return rut;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${formatted}-${dv}`;
}

// ─── Precios anuales ─────────────────────────────────────────────────
// Precios fijos mensualizados al contratar anual (2 meses gratis aprox).

const ANNUAL_MONTHLY_NET: Record<Exclude<PlanKey, "FREE">, number> = {
  GOLD: 29900,
  PREMIUM: 39900,
};

/** Precio NETO mensualizado del plan anual. FREE = 0. */
export function planAnnualNetMonthly(plan: PlanKey): number {
  if (plan === "FREE") return 0;
  return ANNUAL_MONTHLY_NET[plan];
}

/** Total NETO anual (mensualizado × 12). FREE = 0. */
export function planAnnualNetTotal(plan: PlanKey): number {
  return planAnnualNetMonthly(plan) * 12;
}
