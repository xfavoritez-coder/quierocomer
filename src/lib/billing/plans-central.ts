/**
 * SINGLE SOURCE OF TRUTH for all plan configuration.
 *
 * Every component that shows plan info (landing, PlanesModal, /activar,
 * panel suscripcion, plan gates) reads from here. Do NOT hardcode plan
 * data anywhere else.
 *
 * To change plans, prices, or features: edit THIS file only.
 */

export type PlanKey = "FREE" | "SILVER" | "GOLD" | "PREMIUM";

export type Feature =
  | "view_gallery"        // Vista galería
  | "view_feed"           // Vista lista
  | "view_space"          // Vista impact
  | "view_selector"       // Selector de vistas en FAB + dark/light mode
  | "highlight_dishes"    // Destacar platos estrella
  | "promotions"          // Ofertas y promociones
  | "announcements"       // Anuncios en la carta
  | "stats_basic"         // Estadisticas basicas
  | "stats_advanced"      // Estadisticas avanzadas (sesiones, recorridos)
  | "multilang"           // Multilenguaje (ES/EN/PT)
  | "waiter"              // Llamar al garzon
  | "suggestions"         // Cross-selling (cross-sell)
  | "campaigns"           // Email marketing
  | "automations"         // Cumpleanos automaticos
  | "clients_full"        // Clientes captados
  | "clients_export"      // Exportar clientes a CSV
  | "toteat_integration"  // Integracion con Toteat POS
  | "live_dashboard"      // Dashboard en vivo
  | "genio"               // Genio IA
  | "modifiers";          // Modificadores de platos

// --- Plan definitions ---

export interface PlanDef {
  key: PlanKey;
  label: string;
  tagline: string;
  priceMonthly: number;      // CLP neto, 0 = gratis
  priceAnnualMonthly: number; // CLP neto por mes si paga anual (0 = gratis)
  trialDays: number;
  features: Set<Feature>;
  featureDisplay: { text: string; tip: string }[];
  inheritsFrom: string | null; // "Todo lo del plan X"
  isFeatured: boolean;
  ctaText: string;
  flowPlanId: string | null;  // Flow billing plan ID
}

export const PLANS: Record<PlanKey, PlanDef> = {
  FREE: {
    key: "FREE",
    label: "Gratis",
    tagline: "",
    priceMonthly: 0,
    priceAnnualMonthly: 0,
    trialDays: 0,
    features: new Set(["genio", "modifiers", "view_gallery"]),
    featureDisplay: [
      { text: "Carta QR digital", tip: "Tus clientes escanean un QR y ven tu carta al instante." },
      { text: "2 vistas de carta", tip: "Vista Free y vista Galería." },
      { text: "Genio IA incluido", tip: "El Genio reordena tu carta según los gustos de cada cliente." },
      { text: "Panel autoadministrable", tip: "Edita platos, precios y fotos desde tu celular." },
    ],
    inheritsFrom: null,
    isFeatured: false,
    ctaText: "Comenzar gratis",
    flowPlanId: null,
  },

  SILVER: {
    key: "SILVER",
    label: "Silver",
    tagline: "",
    priceMonthly: 14900,
    priceAnnualMonthly: 12900,
    trialDays: 0,
    features: new Set([
      "genio", "modifiers",
      "view_gallery", "view_feed", "view_space", "view_selector",
      "highlight_dishes", "promotions",
    ]),
    featureDisplay: [
      { text: "3 vistas de carta", tip: "Galería, Lista e Impact. Lista como vista por defecto." },
      { text: "Dark / Light mode", tip: "Elige el tema que mejor represente tu local." },
      { text: "Destacar platos estrella", tip: "Resalta visualmente los platos que más te conviene vender." },
      { text: "Ofertas y promociones", tip: "Crea ofertas temporales visibles en la carta." },
    ],
    inheritsFrom: "Todo lo del plan Gratis",
    isFeatured: false,
    ctaText: "Elegir Silver",
    flowPlanId: "qc_silver_monthly",
  },

  GOLD: {
    key: "GOLD",
    label: "Gold",
    tagline: "",
    priceMonthly: 29900,
    priceAnnualMonthly: 24900,
    trialDays: 0,
    features: new Set([
      "genio", "modifiers",
      "view_gallery", "view_feed", "view_space", "view_selector",
      "highlight_dishes", "promotions", "announcements",
      "stats_basic",
      "multilang", "suggestions",
    ]),
    featureDisplay: [
      { text: "Estadísticas", tip: "Visitas, platos más vistos y duración promedio." },
      { text: "Anuncios en carta", tip: "Banner de novedades visible al abrir la carta." },
      { text: "Multilenguaje (ES / EN / PT)", tip: "Tu carta se traduce automáticamente." },
      { text: "Cross-selling", tip: "Sugiere acompañamientos para subir el ticket de cada mesa." },
    ],
    inheritsFrom: "Todo lo del plan Silver",
    isFeatured: true,
    ctaText: "Elegir Gold",
    flowPlanId: "qc_gold_monthly",
  },

  PREMIUM: {
    key: "PREMIUM",
    label: "Premium",
    tagline: "",
    priceMonthly: 44900,
    priceAnnualMonthly: 35900,
    trialDays: 14,
    features: new Set([
      "genio", "modifiers",
      "view_gallery", "view_feed", "view_space", "view_selector",
      "highlight_dishes", "promotions", "announcements",
      "stats_basic", "stats_advanced",
      "multilang", "suggestions",
      "waiter", "campaigns", "automations", "clients_full", "clients_export",
      "toteat_integration", "live_dashboard",
    ]),
    featureDisplay: [
      { text: "Estadísticas avanzadas", tip: "Sesiones en vivo, recorrido de cada cliente, búsquedas." },
      { text: "Llamar al garzón", tip: "El cliente toca un botón y el garzón recibe la notificación push." },
      { text: "Clientes capturados", tip: "Ve todos los clientes capturados: correos, cumpleaños, preferencias y más." },
      { text: "Email marketing", tip: "Envía campañas de email a tu base de clientes." },
      { text: "Cumpleaños automáticos", tip: "Enviamos email a tus clientes que están de cumpleaños invitándolos a que vayan a celebrar a tu restaurante." },
    ],
    inheritsFrom: "Todo lo del plan Gold",
    isFeatured: false,
    ctaText: "Comenzar 14 días gratis",
    flowPlanId: "qc_premium_monthly",
  },
};

// --- Helpers ---

export const PLAN_ORDER: PlanKey[] = ["FREE", "SILVER", "GOLD", "PREMIUM"];
export const PAID_PLANS: PlanKey[] = ["SILVER", "GOLD", "PREMIUM"];

export const IVA_RATE = 0.19;
export const TRIAL_DAYS = 14;
export const GRACE_DAYS = 7;

export function ivaOf(amount: number): number { return Math.round(amount * IVA_RATE); }
export function grossOf(amount: number): number { return amount + ivaOf(amount); }

export function canAccess(plan: string | null | undefined, feature: Feature): boolean {
  const key = normalizePlan(plan);
  return PLANS[key].features.has(feature);
}

export function normalizePlan(plan: string | null | undefined): PlanKey {
  if (!plan) return "FREE";
  const upper = plan.toUpperCase();
  if (upper in PLANS) return upper as PlanKey;
  return "FREE";
}

/** Get the effective plan considering subscription status */
export function effectivePlan(plan: string | null | undefined, subscriptionStatus: string | null | undefined): PlanKey {
  const p = normalizePlan(plan);
  if (p === "FREE") return "FREE";
  if (!subscriptionStatus) return p;
  const s = subscriptionStatus.toUpperCase();
  if (s === "ACTIVE" || s === "TRIALING") return p;
  if (s === "PAST_DUE" || s === "GRACE") return p; // still active during grace
  return "FREE"; // CANCELLED, EXPIRED, etc.
}

export function getPlanPrice(plan: PlanKey, annual = false): string {
  const p = PLANS[plan];
  if (p.priceMonthly === 0) return "$0";
  const amount = annual ? p.priceAnnualMonthly : p.priceMonthly;
  return `$${amount.toLocaleString("es-CL")}`;
}

export function getPlanDef(plan: string | null | undefined): PlanDef {
  return PLANS[normalizePlan(plan)];
}

/** Get the minimum plan required for a feature */
export function requiredPlan(feature: Feature): PlanKey {
  for (const key of PLAN_ORDER) {
    if (PLANS[key].features.has(feature)) return key;
  }
  return "PREMIUM";
}

/** Plan display info (colors for admin UI) */
export const PLAN_INFO: Record<PlanKey, { label: string; color: string; bg: string; border: string }> = {
  FREE: { label: "Gratis", color: "#888", bg: "rgba(0,0,0,0.04)", border: "#ddd" },
  SILVER: { label: "Silver", color: "#475569", bg: "#F1F5F9", border: "#94a3b8" },
  GOLD: { label: "Gold", color: "#92400e", bg: "#FFF8E7", border: "#F4A623" },
  PREMIUM: { label: "Premium", color: "#6d28d9", bg: "#F3E8FF", border: "#c4b5fd" },
};

/** Max visible clients per plan */
export function maxVisibleClients(plan: string | null | undefined): number {
  const p = normalizePlan(plan);
  if (p === "PREMIUM") return Infinity;
  if (p === "GOLD") return 15;
  if (p === "SILVER") return 10;
  return 5;
}
