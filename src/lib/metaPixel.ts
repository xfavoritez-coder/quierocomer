/**
 * Meta Pixel helper — thin wrapper around fbq() so we don't scatter
 * `(window as any).fbq?.()` across every file.
 *
 * Pixel ID: 1532906358481871
 */

type FbqParams = Record<string, string | number | boolean | null | undefined>;

function fbq(event: string, params?: FbqParams) {
  if (typeof window === "undefined") return;
  const f = (window as any).fbq;
  if (typeof f !== "function") return;
  if (params) f("track", event, params);
  else f("track", event);
}

// ── Standard events ──

/** User creates an account */
export function trackRegistration() {
  fbq("CompleteRegistration");
}

/** Landing/planes: user submits local name + email to start */
export function trackLead(data?: { content_name?: string }) {
  fbq("Lead", data);
}

/** User views pricing / plan details */
export function trackViewPlan(plan: string) {
  fbq("ViewContent", { content_name: `Plan ${plan}`, content_type: "product" });
}

/** Free or trial plan activated (no payment) */
export function trackStartTrial(plan: string) {
  fbq("StartTrial", { content_name: `Plan ${plan}`, currency: "CLP", value: 0 });
}

/** Paid plan activated (Gold/Premium via MercadoPago) */
export function trackPurchase(plan: string, value: number) {
  fbq("Purchase", { content_name: `Plan ${plan}`, currency: "CLP", value });
}

/** Subir carta — paso 1 completado (link o fotos enviadas) */
export function trackCartaUpload() {
  fbq("AddToCart", { content_name: "Carta Upload", content_type: "menu" });
}

/** Subir carta — paso 2 completado (datos del local) */
export function trackCartaInfo() {
  fbq("AddPaymentInfo", { content_name: "Carta Info" });
}

/** Carta lista — el restaurante tiene su carta digital activa */
export function trackCartaReady() {
  fbq("Purchase", { content_name: "Carta Digital", currency: "CLP", value: 0 });
}

/** Contact form submitted */
export function trackContact() {
  fbq("Contact");
}

/** Inicio de checkout (redirige a MercadoPago) */
export function trackInitiateCheckout(plan: string) {
  fbq("InitiateCheckout", { content_name: `Plan ${plan}`, currency: "CLP" });
}
