/**
 * Meta Pixel helper — thin wrapper around fbq() so we don't scatter
 * `(window as any).fbq?.()` across every file.
 *
 * Pixel ID: 1532906358481871
 */

type FbqParams = Record<string, string | number | boolean | null | undefined>;

// Plan prices in CLP (neto + IVA) for ROAS tracking — Meta requires value > 0
const PLAN_VALUES: Record<string, number> = { FREE: 49900, GOLD: 41650, PREMIUM: 59381 };
// FREE gets projected Premium value because all free users get 14-day Premium trial

function fbq(event: string, params?: FbqParams) {
  if (typeof window === "undefined") return;
  const f = (window as any).fbq;
  if (typeof f !== "function") return;
  if (params) {
    // Strip null/undefined values so Facebook doesn't receive ""
    const clean: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v != null) clean[k] = v;
    }
    f("track", event, clean);
  } else {
    f("track", event);
  }
}

// ── Standard events ──

/** User creates an account */
export function trackRegistration() {
  fbq("CompleteRegistration", { currency: "CLP", value: 49900 });
}

/** Landing/planes: user submits local name + email to start */
export function trackLead(data?: { content_name?: string }) {
  fbq("Lead", { ...data, currency: "CLP", value: 49900 });
}

/** User views pricing / plan details */
export function trackViewPlan(plan: string) {
  fbq("ViewContent", { content_name: `Plan ${plan}`, content_type: "product", currency: "CLP", value: PLAN_VALUES[plan] || 49900 });
}

/** Free or trial plan activated (no payment yet, but projected value) */
export function trackStartTrial(plan: string) {
  fbq("StartTrial", { content_name: `Plan ${plan}`, currency: "CLP", value: PLAN_VALUES[plan] || 49900 });
}

/** Paid plan activated (Gold/Premium via MercadoPago) */
export function trackPurchase(plan: string, value: number) {
  const v = typeof value === "number" && value > 0 ? value : 49900;
  fbq("Purchase", { content_name: `Plan ${plan}`, currency: "CLP", value: v });
}

/** Subir carta — paso 1 completado (link o fotos enviadas) */
export function trackCartaUpload() {
  fbq("AddToCart", { content_name: "Carta Upload", content_type: "menu", currency: "CLP", value: 49900 });
}

/** Subir carta — paso 2 completado (datos del local = lead real con contacto) */
export function trackCartaInfo() {
  fbq("CompleteRegistration", { content_name: "Subir Carta Completo", currency: "CLP", value: 49900 });
}

/** Carta lista — confirmación final (refuerzo de conversión) */
export function trackCartaReady() {
  fbq("Lead", { content_name: "Carta QR Lista", currency: "CLP", value: 49900 });
}

/** Contact form submitted */
export function trackContact() {
  fbq("Contact");
}

/** Inicio de checkout (redirige a MercadoPago) */
export function trackInitiateCheckout(plan: string) {
  fbq("InitiateCheckout", { content_name: `Plan ${plan}`, currency: "CLP", value: PLAN_VALUES[plan] || 49900 });
}
