/**
 * Plan feature access system.
 *
 * Controls which features are available per plan (FREE / GOLD / PREMIUM).
 * Used in both panel (to gate sections) and carta (to filter views/features).
 */

export type Plan = "FREE" | "GOLD" | "PREMIUM";

export type Feature =
  | "view_gallery"      // Vista galería
  | "view_feed"         // Vista feed
  | "view_space"        // Vista espacial
  | "view_selector"     // Selector de vistas + idiomas
  | "highlight_dishes"  // Destacar platos estrella
  | "promotions"        // Ofertas del día
  | "stats_basic"       // Estadísticas básicas
  | "stats_advanced"    // Estadísticas avanzadas (sesiones, recorridos)
  | "multilang"         // Multilenguaje
  | "waiter"            // Llamar al garzón
  | "suggestions"       // Productos sugeridos (cross-sell)
  | "automations"       // Automatizaciones (emails automáticos)
  | "campaigns"         // Campañas y email marketing
  | "announcements"     // Anuncios en la carta
  | "modifiers"         // Modificadores de platos
  | "clients_full"      // Ver todos los clientes
  | "clients_export"    // Exportar clientes a CSV
  | "toteat_integration" // Integración con Toteat POS (cruce vista vs venta, dashboard live)
  | "live_dashboard";   // Dashboard en vivo del local (requiere Toteat)

const PLAN_FEATURES: Record<Plan, Set<Feature>> = {
  FREE: new Set([
    "modifiers",
  ]),
  GOLD: new Set([
    "modifiers",
    "view_gallery",
    "view_selector",
    "highlight_dishes",
    "promotions",
    "stats_basic",
    "multilang",
    "announcements",
  ]),
  PREMIUM: new Set([
    "modifiers",
    "view_gallery",
    "view_feed",
    "view_space",
    "view_selector",
    "highlight_dishes",
    "promotions",
    "stats_basic",
    "stats_advanced",
    "multilang",
    "waiter",
    "suggestions",
    "automations",
    "campaigns",
    "announcements",
    "clients_full",
    "clients_export",
    "toteat_integration",
    "live_dashboard",
  ]),
};

/** Check if a plan has access to a feature */
export function canAccess(plan: Plan | string | undefined | null, feature: Feature): boolean {
  const p = (plan || "FREE") as Plan;
  return PLAN_FEATURES[p]?.has(feature) ?? false;
}

/** Get the minimum plan required for a feature */
export function requiredPlan(feature: Feature): Plan {
  if (PLAN_FEATURES.FREE.has(feature)) return "FREE";
  if (PLAN_FEATURES.GOLD.has(feature)) return "GOLD";
  return "PREMIUM";
}

/** Plan display info */
export const PLAN_INFO: Record<Plan, { label: string; color: string; bg: string; border: string }> = {
  FREE: { label: "Gratis", color: "#888", bg: "rgba(0,0,0,0.04)", border: "#ddd" },
  GOLD: { label: "Gold", color: "#92400e", bg: "#FFF8E7", border: "#F4A623" },
  PREMIUM: { label: "Premium", color: "#6d28d9", bg: "#F3E8FF", border: "#c4b5fd" },
};

/** Max visible clients per plan */
export function maxVisibleClients(plan: Plan | string | undefined | null): number {
  const p = (plan || "FREE") as Plan;
  if (p === "PREMIUM") return Infinity;
  if (p === "GOLD") return 15;
  return 5;
}
