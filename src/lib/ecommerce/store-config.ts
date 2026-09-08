// ═══════════════════════════════════════════════════════════
//  Configuración de la tienda del Ecommerce (owner-editable):
//  colores de marca, métodos de pago visibles y notas del cliente.
//  Vive en Restaurant.ecommerceStoreConfig (JSON).
// ═══════════════════════════════════════════════════════════

export const ALL_PAYMENT_METHODS = ["webpay", "flow", "mercadopago", "efectivo", "transferencia", "tarjeta"] as const;
export type PaymentMethod = (typeof ALL_PAYMENT_METHODS)[number];

export const DEFAULT_PRIMARY = "#e63946";
export const DEFAULT_HEADER_BG = "#ffffff";

export interface EcommerceStoreConfig {
  primaryColor: string; // color principal (botones, precios, acentos)
  headerBgColor: string; // fondo del header (detrás del logo)
  categoryColor: string; // color de los títulos de categoría (= principal si no se define)
  paymentMethods: string[]; // métodos de pago que se muestran al cliente
  notesEnabled: boolean; // mostrar el campo de notas (opcional) en el checkout
  posShowDescriptions: boolean; // mostrar la descripción de los productos en "Tomar pedidos"
  pickupEnabled: boolean; // aceptar pedidos para retiro en local
  deliveryEnabled: boolean; // aceptar pedidos con delivery
  minOrderPickup: number; // monto mínimo de compra para retiro (0 = sin mínimo)
  minOrderDelivery: number; // monto mínimo de compra para delivery (0 = sin mínimo)
  waitTimePickup: string; // tiempo estimado de retiro (ej: "20-30")
  waitTimeDelivery: string; // tiempo estimado de delivery (ej: "40-60")
  favoritesEnabled: boolean; // permitir que el cliente marque favoritos
  theme: "base" | "impact"; // tema visual del storefront ("base" claro | "impact" oscuro)
  bannerProductIds: string[]; // hasta 5 productos destacados en el banner del tema impact
  customDomain: string | null; // dominio propio (ej: "haruna.cl"); null = quierocomer.com/ecommerce/<slug>
  gtmId: string | null; // Google Tag Manager container id (ej: "GTM-XXXXXX"); null = sin GTM
  survey: SurveyConfig; // encuestas de satisfacción (envío automático tras la entrega)
}

/** Normaliza un ID de Google Tag Manager ("GTM-XXXXXX"); null si no es válido. */
export function normalizeGtmId(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const id = v.trim().toUpperCase();
  return /^GTM-[A-Z0-9]{4,12}$/.test(id) ? id : null;
}

// ── Encuestas de satisfacción ──
export interface SurveyQuestion {
  id: string;
  text: string;
  active: boolean;
}
export interface SurveyConfig {
  enabled: boolean; // enviar encuestas automáticamente
  hoursAfter: number; // horas después de que el pedido queda Entregado (DONE)
  subject: string; // asunto del correo (admite {nombre} y {local})
  intro: string; // texto de introducción (admite {nombre} y {local})
  thankYou: string; // mensaje tras responder
  questions: SurveyQuestion[]; // preguntas (orden = orden del array); escala 1-5
}

export const DEFAULT_SURVEY_QUESTIONS: SurveyQuestion[] = [
  { id: "q_web", text: "¿Cómo calificarías tu experiencia en la página web?", active: true },
  { id: "q_delivery", text: "¿Cómo calificarías la rapidez de la entrega?", active: true },
  { id: "q_food", text: "¿Cómo calificarías la comida?", active: true },
];

const DEFAULT_SURVEY: SurveyConfig = {
  enabled: false,
  hoursAfter: 3,
  subject: "¿Cómo estuvo tu pedido de {local}?",
  intro: "Nos encantaría conocer tu opinión. Califica tu experiencia del 1 al 5.",
  thankYou: "¡Gracias por tu respuesta!",
  questions: DEFAULT_SURVEY_QUESTIONS,
};

function parseSurvey(raw: unknown): SurveyConfig {
  const o = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const hasSurvey = Object.keys(o).length > 0;
  const questions = Array.isArray(o.questions)
    ? (o.questions as unknown[])
        .map((q) => (q && typeof q === "object" ? (q as Record<string, unknown>) : {}))
        .map((q) => ({
          id: typeof q.id === "string" && q.id ? q.id : `s_${Math.random().toString(36).slice(2, 10)}`,
          text: typeof q.text === "string" ? q.text.trim().slice(0, 160) : "",
          active: q.active !== false,
        }))
        .filter((q) => q.text)
        .slice(0, 12)
    : DEFAULT_SURVEY_QUESTIONS;
  return {
    enabled: o.enabled === true,
    hoursAfter: nonNegInt(o.hoursAfter, DEFAULT_SURVEY.hoursAfter) || DEFAULT_SURVEY.hoursAfter,
    subject: typeof o.subject === "string" && o.subject.trim() ? o.subject.trim().slice(0, 160) : DEFAULT_SURVEY.subject,
    intro: typeof o.intro === "string" && o.intro.trim() ? o.intro.trim().slice(0, 400) : DEFAULT_SURVEY.intro,
    thankYou: typeof o.thankYou === "string" && o.thankYou.trim() ? o.thankYou.trim().slice(0, 200) : DEFAULT_SURVEY.thankYou,
    // Si nunca se configuró, usa las preguntas por defecto; si ya hay config, respeta la lista guardada.
    questions: hasSurvey && Array.isArray(o.questions) ? questions : DEFAULT_SURVEY_QUESTIONS,
  };
}

export type StoreTheme = EcommerceStoreConfig["theme"];

interface Fallback {
  accent?: string | null;
  paymentMethods?: string[];
  minOrder?: number | null; // mínimo legacy (orderingMinAmount) para sembrar defaults
  waitTime?: string | null; // waitTime legacy (orderingWaitTime) para sembrar defaults
}

function isHex(v: unknown): v is string {
  return typeof v === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v.trim());
}

/** Normaliza el JSON crudo a una config concreta, resolviendo defaults/fallbacks. */
export function parseStoreConfig(raw: unknown, fb: Fallback = {}): EcommerceStoreConfig {
  const o = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const primary = isHex(o.primaryColor) ? o.primaryColor.trim() : isHex(fb.accent) ? (fb.accent as string) : DEFAULT_PRIMARY;
  const methods = Array.isArray(o.paymentMethods)
    ? (o.paymentMethods as unknown[]).map(String).filter((m) => (ALL_PAYMENT_METHODS as readonly string[]).includes(m))
    : fb.paymentMethods ?? [];
  const fbMin = Math.max(0, Math.round(Number(fb.minOrder) || 0));
  return {
    primaryColor: primary,
    headerBgColor: isHex(o.headerBgColor) ? o.headerBgColor.trim() : DEFAULT_HEADER_BG,
    categoryColor: isHex(o.categoryColor) ? o.categoryColor.trim() : primary,
    paymentMethods: methods,
    notesEnabled: o.notesEnabled !== false,
    posShowDescriptions: o.posShowDescriptions === true,
    pickupEnabled: o.pickupEnabled !== false,
    deliveryEnabled: o.deliveryEnabled !== false,
    minOrderPickup: nonNegInt(o.minOrderPickup, fbMin),
    minOrderDelivery: nonNegInt(o.minOrderDelivery, fbMin),
    waitTimePickup: typeof o.waitTimePickup === "string" ? o.waitTimePickup : (fb.waitTime ?? ""),
    waitTimeDelivery: typeof o.waitTimeDelivery === "string" ? o.waitTimeDelivery : (fb.waitTime ?? ""),
    favoritesEnabled: o.favoritesEnabled === true,
    theme: o.theme === "impact" ? "impact" : "base",
    bannerProductIds: Array.isArray(o.bannerProductIds)
      ? (o.bannerProductIds as unknown[]).map(String).filter(Boolean).slice(0, 5)
      : [],
    customDomain: normalizeDomain(o.customDomain),
    gtmId: normalizeGtmId(o.gtmId),
    survey: parseSurvey(o.survey),
  };
}

/** Normaliza un dominio: minúsculas, sin protocolo, sin "www.", sin ruta ni espacios.
 *  Devuelve null si no parece un dominio válido. */
export function normalizeDomain(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const d = v.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
  return d && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d) ? d : null;
}

/** Ruta base de la tienda según el host de la request:
 *  - dominio propio (host === customDomain) → "" (URLs limpias: haruna.cl/checkout)
 *  - dominio principal → "/ecommerce/<slug>" (quierocomer.com/ecommerce/haruna) */
export function storeBasePath(opts: { host?: string | null; slug: string; customDomain?: string | null }): string {
  const host = (opts.host || "").split(":")[0].toLowerCase().replace(/^www\./, "");
  if (opts.customDomain && host === opts.customDomain) return "";
  return `/ecommerce/${opts.slug}`;
}

// Entero ≥ 0 o el fallback si el valor no es válido.
function nonNegInt(v: unknown, fallback: number): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}
