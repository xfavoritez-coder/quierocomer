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
  waitTimeDriver: string; // tiempo estimado para el repartidor (ej: "15-20"); se incluye en el JSON de pedidos
  scheduledOrdersEnabled: boolean; // permitir que el cliente programe pedidos para más tarde
  scheduleMaxDaysAhead: number; // hasta cuántos días hacia adelante se puede programar (0 = solo hoy, 1 = hasta mañana, N = N días)
  showTableMenu: boolean; // mostrar "Carta mesa" en el menú del storefront (link a /qr/<slug>)
  posRetryEnabled: boolean; // reintentar automáticamente el envío al POS (Toteat) si falla (p. ej. caja cerrada)
  favoritesEnabled: boolean; // permitir que el cliente marque favoritos
  theme: "base" | "impact"; // tema visual del storefront ("base" claro | "impact" oscuro)
  bannerProductIds: string[]; // hasta 5 productos destacados en el banner del tema impact
  customDomain: string | null; // dominio propio (ej: "haruna.cl"); null = quierocomer.com/ecommerce/<slug>
  brandSlug: string | null; // marca multisucursal: varias tiendas con el mismo brandSlug son sucursales de una misma marca (entrada /ecommerce/marca/<brandSlug>)
  brandDomain: string | null; // dominio propio de la MARCA (ej: "kojo.cl"): sirve la página de marca (elige sucursal al pedir), no una sola tienda
  branchName: string | null; // nombre de esta sucursal dentro de la marca (ej: "Providencia")
  storeLogoUrl: string | null; // logo propio de la tienda ecommerce (null = usa el logo del local en configuración)
  faviconUrl: string | null; // favicon de la tienda y de la web de seguimiento (null = usa el logo)
  bannerUrl: string | null; // imagen de banner/hero de la tienda (tema base); null = sin banner
  gtmId: string | null; // Google Tag Manager container id (ej: "GTM-XXXXXX"); null = sin GTM
  metaPixelId: string | null; // Meta (Facebook) Pixel ID (solo dígitos, 15-16 cifras); null = sin Pixel
  pageTitle: string | null; // <title> personalizado en Google (null = "{Nombre} · Pedir online")
  metaDescription: string | null; // meta description para Google (null = texto genérico)
  // Contacto que muestra la página de Política de Privacidad (/privacidad). null = usa el del local.
  privacyEmail: string | null;
  privacyPhone: string | null;
  privacyAddress: string | null;
  orderNotifyEmail: string | null; // correo del local que recibe aviso de cada pedido nuevo
  survey: SurveyConfig; // encuestas de satisfacción (envío automático tras la entrega)
  printMode: "off" | "manual" | "auto"; // impresión de comandas: off | botón manual | automática al llegar
  printPaperWidth: 58 | 80; // ancho del papel térmico en mm
  printCopies: 1 | 2; // cuántas copias de la comanda imprimir por pedido (1 o 2)
  kitchenComanda: boolean; // imprimir además una comanda de cocina (letra grande, sin precios) por pedido
  autoPreparingOnTrack: boolean; // al abrir el seguimiento, el pedido pasa solo de ACCEPTED a PREPARING
  trackingEmailEnabled: boolean; // enviar al cliente el correo de seguimiento del pedido (ON por defecto)
  printToken: string | null; // token del agente de impresión local (ESC/POS); null = sin agente
  printTokenAt: string | null; // ISO: cuándo se generó el token (el agente solo imprime pedidos posteriores)
  printTestAt: string | null; // ISO: solicitud de impresión de prueba pendiente (el agente la imprime en su próximo sondeo)
  printTestAckAt: string | null; // ISO: cuándo el agente confirmó la última prueba (para no repetirla)
  printTarget: "default" | "name" | "ip"; // a qué impresora imprime el agente: predeterminada de Windows | por nombre | por IP directa (:9100)
  printerName: string | null; // nombre exacto de la impresora de Windows (cuando printTarget = "name")
  printerIp: string | null; // IP (o IP:puerto) de la impresora de red para ESC/POS directo (cuando printTarget = "ip"); puerto por defecto 9100
  // Impresora de COCINA (opcional): si el local tiene 2 impresoras, la comanda de
  // cocina sale por esta y la comanda normal (caja) por la de arriba. "same" = usa
  // la misma de caja (una sola impresora).
  kitchenPrintTarget: "same" | "name" | "ip"; // a qué impresora va la comanda de cocina
  kitchenPrinterName: string | null; // nombre exacto de la impresora de cocina (cuando kitchenPrintTarget = "name")
  kitchenPrinterIp: string | null; // IP (o IP:puerto) de la impresora de cocina (cuando kitchenPrintTarget = "ip")
}

/** Normaliza un email; null si no tiene forma válida. */
export function normalizeEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const e = v.trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? e : null;
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
    waitTimeDriver: typeof o.waitTimeDriver === "string" ? o.waitTimeDriver : "",
    scheduledOrdersEnabled: o.scheduledOrdersEnabled === true,
    scheduleMaxDaysAhead: nonNegInt(o.scheduleMaxDaysAhead, 0),
    showTableMenu: o.showTableMenu === true,
    posRetryEnabled: o.posRetryEnabled === true,
    favoritesEnabled: o.favoritesEnabled !== false, // ON por defecto en todos los locales (se apaga explícitamente)
    theme: o.theme === "impact" ? "impact" : "base",
    bannerProductIds: Array.isArray(o.bannerProductIds)
      ? (o.bannerProductIds as unknown[]).map(String).filter(Boolean).slice(0, 5)
      : [],
    customDomain: normalizeDomain(o.customDomain),
    brandSlug: typeof o.brandSlug === "string" && o.brandSlug.trim() ? o.brandSlug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || null : null,
    brandDomain: normalizeDomain(o.brandDomain),
    branchName: typeof o.branchName === "string" && o.branchName.trim() ? o.branchName.trim().slice(0, 60) : null,
    storeLogoUrl: typeof o.storeLogoUrl === "string" && o.storeLogoUrl.trim() ? o.storeLogoUrl.trim() : null,
    faviconUrl: typeof o.faviconUrl === "string" && o.faviconUrl.trim() ? o.faviconUrl.trim() : null,
    bannerUrl: typeof o.bannerUrl === "string" && o.bannerUrl.trim() ? o.bannerUrl.trim() : null,
    gtmId: normalizeGtmId(o.gtmId),
    metaPixelId: typeof o.metaPixelId === "string" && o.metaPixelId.trim() ? o.metaPixelId.trim().replace(/\D/g, "").slice(0, 20) || null : null,
    pageTitle: typeof o.pageTitle === "string" && o.pageTitle.trim() ? o.pageTitle.trim().slice(0, 120) : null,
    metaDescription: typeof o.metaDescription === "string" && o.metaDescription.trim() ? o.metaDescription.trim().slice(0, 300) : null,
    privacyEmail: typeof o.privacyEmail === "string" && o.privacyEmail.trim() ? o.privacyEmail.trim() : null,
    privacyPhone: typeof o.privacyPhone === "string" && o.privacyPhone.trim() ? o.privacyPhone.trim() : null,
    privacyAddress: typeof o.privacyAddress === "string" && o.privacyAddress.trim() ? o.privacyAddress.trim() : null,
    orderNotifyEmail: normalizeEmail(o.orderNotifyEmail),
    survey: parseSurvey(o.survey),
    printMode: o.printMode === "auto" ? "auto" : o.printMode === "off" ? "off" : "manual",
    printPaperWidth: Number(o.printPaperWidth) === 58 ? 58 : 80,
    printCopies: Number(o.printCopies) === 2 ? 2 : 1,
    kitchenComanda: o.kitchenComanda === true,
    autoPreparingOnTrack: o.autoPreparingOnTrack === true,
    trackingEmailEnabled: o.trackingEmailEnabled !== false, // ON por defecto
    printToken: typeof o.printToken === "string" && o.printToken.trim() ? o.printToken.trim() : null,
    printTokenAt: typeof o.printTokenAt === "string" && o.printTokenAt.trim() ? o.printTokenAt.trim() : null,
    printTestAt: typeof o.printTestAt === "string" && o.printTestAt.trim() ? o.printTestAt.trim() : null,
    printTestAckAt: typeof o.printTestAckAt === "string" && o.printTestAckAt.trim() ? o.printTestAckAt.trim() : null,
    printTarget: o.printTarget === "name" ? "name" : o.printTarget === "ip" ? "ip" : "default",
    printerName: typeof o.printerName === "string" && o.printerName.trim() ? o.printerName.trim() : null,
    printerIp: typeof o.printerIp === "string" && o.printerIp.trim() ? o.printerIp.trim() : null,
    kitchenPrintTarget: o.kitchenPrintTarget === "name" ? "name" : o.kitchenPrintTarget === "ip" ? "ip" : "same",
    kitchenPrinterName: typeof o.kitchenPrinterName === "string" && o.kitchenPrinterName.trim() ? o.kitchenPrinterName.trim() : null,
    kitchenPrinterIp: typeof o.kitchenPrinterIp === "string" && o.kitchenPrinterIp.trim() ? o.kitchenPrinterIp.trim() : null,
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
 *  - dominio de marca (host === brandDomain) → "" (kojo.cl/checkout)
 *  - dominio principal → "/ecommerce/<slug>" (quierocomer.com/ecommerce/haruna) */
export function storeBasePath(opts: { host?: string | null; slug: string; customDomain?: string | null; brandDomain?: string | null }): string {
  const host = (opts.host || "").split(":")[0].toLowerCase().replace(/^www\./, "");
  if (opts.customDomain && host === opts.customDomain) return "";
  if (opts.brandDomain && host === opts.brandDomain) return "";
  return `/ecommerce/${opts.slug}`;
}

// Entero ≥ 0 o el fallback si el valor no es válido.
function nonNegInt(v: unknown, fallback: number): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}
