import { getPlatformSetting, setPlatformSetting } from "@/lib/platformSettings";

/**
 * Precios de QuieroComer (planes, add-ons, implementación y otros cobros).
 * Solo el superadmin los edita desde /admin/precios. Se guardan como JSON en
 * PlatformSetting (key "pricing_config"). Si no hay nada guardado, se usa
 * DEFAULT_PRICING (sembrado desde el Excel "Precios QuieroComer.com").
 */

export interface PricePlan {
  id: string;
  name: string;
  price: number; // CLP / mes
  features: string[];
}

export interface PriceLine {
  id: string;
  label: string;
  price: number; // CLP
  note?: string;
}

export interface PricingConfig {
  plans: PricePlan[];          // Planes de ecommerce (mensual)
  addons: PricePlan[];         // Paquetes / add-ons
  implementation: PriceLine[]; // Implementación (pago único)
  extras: PriceLine[];         // Otros cobros variables
}

const KEY = "pricing_config";

const COMMON = [
  "Sitio Web Propio",
  "Comandador de pedidos",
  "Pasarela de Pago",
  "Repartidores externos (cobro por delivery)",
  "Servicio de soporte",
  "Impresión de comandas",
  "Creación de cupones",
  "Encuestas a clientes",
  "Reportes de ventas y clientes",
  "Pantalla KDS",
];
const SEGUIMIENTO = "Seguimiento en vivo con tracking propio (App repartidores propios)";
const WPP_AUTO = "WhatsApp automático al cliente con link de seguimiento y estado del pedido";

export const DEFAULT_PRICING: PricingConfig = {
  plans: [
    { id: "basico", name: "Plan Básico", price: 19900, features: [...COMMON, SEGUIMIENTO, WPP_AUTO, "Hasta 100 pedidos mensuales"] },
    { id: "avanzado", name: "Plan Avanzado", price: 39900, features: [...COMMON, SEGUIMIENTO, WPP_AUTO, "Hasta 400 pedidos mensuales"] },
    { id: "premium", name: "Plan Premium", price: 89900, features: [...COMMON, "Pedidos ilimitados", SEGUIMIENTO, WPP_AUTO] },
    { id: "futuro-premium", name: "Futuro Plan Premium", price: 99900, features: [...COMMON, "Pedidos ilimitados", SEGUIMIENTO, WPP_AUTO, "POS Propio", "Bodega-Inventario"] },
  ],
  addons: [
    { id: "loyalty", name: "Loyalty", price: 29900, features: ["Tarjeta de membresía", "Notificaciones a clientes", "Notificaciones automáticas el día del cumpleaños"] },
    { id: "qr-loyalty", name: "Carta QR Premium + Loyalty", price: 44900, features: ["Carta QR Premium", "Pedidos online por WhatsApp", "Valoraciones", "Multilenguaje", "Llamar al garzón", "Exportar carta imprimible", "Loyalty", "Gestión de fila virtual"] },
  ],
  implementation: [
    { id: "imp-basico", label: "Plan Básico", price: 29900 },
    { id: "imp-avanzado", label: "Plan Avanzado", price: 49900 },
    { id: "imp-premium", label: "Plan Premium", price: 59900 },
    { id: "imp-futuro", label: "Futuro Plan Premium", price: 69900 },
    { id: "imp-loyalty", label: "Loyalty", price: 19900 },
    { id: "imp-qr-loyalty", label: "Carta QR Premium + Loyalty", price: 29900 },
  ],
  extras: [
    { id: "redes", label: "Instalación de redes e impresoras", price: 1000, note: "por metro de cable de red" },
    { id: "wpp-msg", label: "WhatsApp enviado al cliente", price: 30, note: "por mensaje enviado" },
    { id: "dominio", label: "Dominio propio .cl", price: 19900, note: "Al contratar 1 año, dominio gratis el primer año. Después, $19.900/año." },
  ],
};

function cleanPlans(a: unknown): PricePlan[] {
  if (!Array.isArray(a)) return [];
  return a.map((x, i) => {
    const o = (x || {}) as Record<string, unknown>;
    return {
      id: String(o.id || `p${i}`),
      name: String(o.name || "").trim(),
      price: Math.max(0, Math.round(Number(o.price) || 0)),
      features: Array.isArray(o.features) ? o.features.map((f) => String(f)).filter((f) => f.trim() !== "") : [],
    };
  });
}

function cleanLines(a: unknown): PriceLine[] {
  if (!Array.isArray(a)) return [];
  return a.map((x, i) => {
    const o = (x || {}) as Record<string, unknown>;
    const note = String(o.note || "").trim();
    return {
      id: String(o.id || `l${i}`),
      label: String(o.label || "").trim(),
      price: Math.max(0, Math.round(Number(o.price) || 0)),
      ...(note ? { note } : {}),
    };
  });
}

function normalize(p: unknown): PricingConfig {
  const o = (p || {}) as Record<string, unknown>;
  return {
    plans: cleanPlans(o.plans),
    addons: cleanPlans(o.addons),
    implementation: cleanLines(o.implementation),
    extras: cleanLines(o.extras),
  };
}

export async function getPricing(): Promise<PricingConfig> {
  const raw = await getPlatformSetting(KEY);
  if (!raw) return DEFAULT_PRICING;
  try {
    return normalize(JSON.parse(raw));
  } catch {
    return DEFAULT_PRICING;
  }
}

export async function setPricing(cfg: PricingConfig): Promise<void> {
  await setPlatformSetting(KEY, JSON.stringify(normalize(cfg)));
}
