/**
 * Lifecycle stage computation — pure functions, no DB access.
 * Used by /api/admin/lifecycle and /api/cron/nurturing.
 */

export type LifecycleStage =
  | "LEAD_PROCESANDO" | "LEAD_FALLIDO" | "LEAD_NO_VIO" | "LEAD_VIO_NO_ACTIVO"
  | "ACTIVADO_SIN_USO" | "TRIAL_USANDO" | "TRIAL_ACTIVO" | "TRIAL_DORMIDO" | "TRIAL_VENCIDO"
  | "ACTIVO" | "BONIFICADO" | "DORMIDO" | "DEMO";

/** Only these PanelActivity actions count as real owner activity for dormancy checks */
export const OWNER_ACTIONS = new Set([
  "panel_login", "panel_visit",
  "dish_edit", "dish_create", "dish_delete", "dish_show", "dish_hide",
  "photo_upload",
  "category_edit", "category_create", "category_delete", "category_show", "category_hide",
  "promo_create", "promo_edit",
  "announcement_create",
  "settings_change",
]);

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export interface LifecycleInput {
  // Restaurant fields (null if orphan lead without restaurant)
  restaurant: {
    isDemo: boolean;
    plan: string;
    subscriptionStatus: string;
    trialEndsAt: Date | null;
    billingExempt?: boolean;
    ownerLastLoginAt: Date | null;
    hasOwner: boolean;
  } | null;

  // Lead fields (null if restaurant created manually without lead)
  lead: {
    cartaStatus: string;
    emailClickedAt: Date | null;
    whatsappClickedAt: Date | null;
    activated: boolean;
  } | null;

  /** Most recent owner-initiated PanelActivity date */
  lastOwnerActivity: Date | null;

  /** Number of visitor sessions in last 7 days */
  sessions7d: number;
}

export function computeLifecycleStage(input: LifecycleInput, now = new Date()): LifecycleStage {
  const { restaurant: r, lead, lastOwnerActivity, sessions7d } = input;

  // No restaurant → pure lead stages
  if (!r) {
    if (!lead) return "DEMO"; // shouldn't happen, but fallback
    if (lead.cartaStatus === "FAILED") return "LEAD_FALLIDO";
    if (["PENDING", "PROCESSING", "READY"].includes(lead.cartaStatus)) return "LEAD_PROCESANDO";
    if (!lead.emailClickedAt && !lead.whatsappClickedAt) return "LEAD_NO_VIO";
    return "LEAD_VIO_NO_ACTIVO";
  }

  // Demo restaurant
  if (r.isDemo) {
    if (!lead) return "DEMO";
    if (lead.cartaStatus === "FAILED") return "LEAD_FALLIDO";
    if (["PENDING", "PROCESSING", "READY"].includes(lead.cartaStatus)) return "LEAD_PROCESANDO";
    if (!lead.emailClickedAt && !lead.whatsappClickedAt) return "LEAD_NO_VIO";
    return "LEAD_VIO_NO_ACTIVO";
  }

  // Bonificado
  if (r.billingExempt) return "BONIFICADO";

  // Active paying
  if (r.subscriptionStatus === "ACTIVE") return "ACTIVO";

  // Trial
  if (r.subscriptionStatus === "TRIALING" && r.trialEndsAt) {
    if (r.trialEndsAt.getTime() > now.getTime()) {
      // Trial still valid — check if using or dormant
      if (isDormant(lastOwnerActivity, r.ownerLastLoginAt, now)) return "TRIAL_DORMIDO";
      // Differentiate "using" (has real sessions) from just "active" (logged in but no traction)
      if (sessions7d >= 10) return "TRIAL_USANDO";
      return "TRIAL_ACTIVO";
    }
    return "TRIAL_VENCIDO";
  }

  // Trial expired without TRIALING status (downgraded to FREE/NONE)
  if (r.trialEndsAt && r.trialEndsAt.getTime() < now.getTime() && r.subscriptionStatus === "NONE") {
    return "TRIAL_VENCIDO";
  }

  // Activated but never used
  if (r.hasOwner && !r.ownerLastLoginAt && !lastOwnerActivity) return "ACTIVADO_SIN_USO";

  // Dormant check
  if (isDormant(lastOwnerActivity, r.ownerLastLoginAt, now)) return "DORMIDO";

  // Fallback — has owner, some activity, not paying
  return "DORMIDO";
}

function isDormant(lastOwnerActivity: Date | null, lastLogin: Date | null, now: Date): boolean {
  const latest = [lastOwnerActivity, lastLogin].filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0];
  if (!latest) return true;
  return (now.getTime() - latest.getTime()) > SEVEN_DAYS_MS;
}

// ── Engagement Score ──

export interface EngagementInput {
  hasDishes: boolean;
  viewedCarta: boolean;
  activated: boolean;
  editedDish: boolean;
  uploadedPhoto: boolean;
  hasVisitorSessions: boolean;
  has10PlusSessions: boolean;
  hasRegisteredClients: boolean;
  loggedInToPanel: boolean;
  madePayment: boolean;
}

export const ENGAGEMENT_CRITERIA = [
  "Platos extraídos",
  "Vio su carta",
  "Activó",
  "Editó plato",
  "Subió foto",
  "Visitas reales",
  "10+ visitas",
  "Clientes registrados",
  "Login al panel",
  "Pagó",
] as const;

export function computeEngagementScore(input: EngagementInput): { score: number; checks: boolean[] } {
  const checks = [
    input.hasDishes,
    input.viewedCarta,
    input.activated,
    input.editedDish,
    input.uploadedPhoto,
    input.hasVisitorSessions,
    input.has10PlusSessions,
    input.hasRegisteredClients,
    input.loggedInToPanel,
    input.madePayment,
  ];
  const score = checks.filter(Boolean).length * 10;
  return { score, checks };
}

// ── Stage metadata for UI ──

export const STAGE_META: Record<LifecycleStage, { label: string; color: string; bg: string }> = {
  LEAD_PROCESANDO:    { label: "Procesando",        color: "#60a5fa", bg: "rgba(96,165,250,.12)" },
  LEAD_FALLIDO:       { label: "Falló",             color: "#f87171", bg: "rgba(248,113,113,.12)" },
  LEAD_NO_VIO:        { label: "No vio carta",      color: "#fbbf24", bg: "rgba(251,191,36,.12)" },
  LEAD_VIO_NO_ACTIVO: { label: "Vio, no activó",    color: "#fb923c", bg: "rgba(251,146,60,.12)" },
  ACTIVADO_SIN_USO:   { label: "Activó, sin uso",   color: "#f87171", bg: "rgba(248,113,113,.12)" },
  TRIAL_USANDO:       { label: "Trial usando",      color: "#22d3ee", bg: "rgba(34,211,238,.12)" },
  TRIAL_ACTIVO:       { label: "Trial activo",      color: "#a855f7", bg: "rgba(168,85,247,.12)" },
  TRIAL_DORMIDO:      { label: "Trial dormido",     color: "#f87171", bg: "rgba(248,113,113,.12)" },
  TRIAL_VENCIDO:      { label: "Trial vencido",     color: "#999",    bg: "rgba(255,255,255,.06)" },
  ACTIVO:             { label: "Activo pagando",     color: "#4ade80", bg: "rgba(74,222,128,.12)" },
  BONIFICADO:         { label: "Bonificado",         color: "#4ade80", bg: "rgba(74,222,128,.08)" },
  DORMIDO:            { label: "Dormido",            color: "#f87171", bg: "rgba(248,113,113,.1)" },
  DEMO:               { label: "Demo",               color: "#60a5fa", bg: "rgba(96,165,250,.1)" },
};
