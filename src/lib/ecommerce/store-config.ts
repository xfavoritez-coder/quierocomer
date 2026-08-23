// ═══════════════════════════════════════════════════════════
//  Configuración de la tienda del Ecommerce (owner-editable):
//  colores de marca, métodos de pago visibles y notas del cliente.
//  Vive en Restaurant.ecommerceStoreConfig (JSON).
// ═══════════════════════════════════════════════════════════

export const ALL_PAYMENT_METHODS = ["webpay", "flow", "efectivo", "transferencia", "tarjeta"] as const;
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
}

interface Fallback {
  accent?: string | null;
  paymentMethods?: string[];
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
  return {
    primaryColor: primary,
    headerBgColor: isHex(o.headerBgColor) ? o.headerBgColor.trim() : DEFAULT_HEADER_BG,
    categoryColor: isHex(o.categoryColor) ? o.categoryColor.trim() : primary,
    paymentMethods: methods,
    notesEnabled: o.notesEnabled !== false,
    posShowDescriptions: o.posShowDescriptions === true,
  };
}
