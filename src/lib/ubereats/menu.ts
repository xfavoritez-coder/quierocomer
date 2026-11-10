// ═══════════════════════════════════════════════════════════
//  Sincronización del menú de un local de QuieroComer → Uber Eats.
//  GENÉRICO por restaurantId: sirve para cualquier local (hoy se
//  prueba con Hand Roll). Convierte la carta (categorías, platos,
//  precios CLP) al schema de la Menu API v2 de Uber.
//
//  ⚠️ Precios en unidad MENOR (×100): CLP 5900 → 590000 (igual que
//  los montos de pedido). Verificado en sandbox (PUT 204 OK).
//  v1: sin opciones/modificadores (modifier_groups vacío); los platos
//  agotados/ocultos se omiten. Las opciones quedan para una v2.
// ═══════════════════════════════════════════════════════════
import { prisma } from "@/lib/prisma";
import { parseEcommerceConfig } from "@/lib/ecommerce/config";
import { loadEcommerceStorefront } from "@/lib/ecommerce/storefront-data";
import { putStoreMenu } from "./client";

const LANG = "es";
const tr = (s: string) => ({ translations: { [LANG]: (s || "").slice(0, 255) } });
const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const ALL_DAY = DAYS.map((d) => ({ day_of_week: d, time_periods: [{ start_time: "00:00", end_time: "23:59" }] }));

export interface UberMenuPayload { menus: unknown[]; categories: unknown[]; items: unknown[]; modifier_groups: unknown[] }

/** Arma el payload de menú de Uber a partir de la carta del local. null si el
 *  local no tiene slug o carta. */
export async function buildUberMenu(restaurantId: string): Promise<{ menu: UberMenuPayload; counts: { categories: number; items: number } } | null> {
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { slug: true } });
  if (!r?.slug) return null;
  const sf = await loadEcommerceStorefront(r.slug);
  if (!sf) return null;

  // Solo platos pedibles: visibles, no agotados, con nombre y precio > 0.
  const products = sf.products.filter((p) => !p.hidden && !p.is_sold_out && p.name && (p.price || 0) > 0);
  const usedCat = new Set(products.map((p) => p.category_id));
  const categories = sf.categories.filter((c) => usedCat.has(c.id));
  const catIds = categories.map((c) => c.id);

  const menu: UberMenuPayload = {
    menus: [{ id: "menu_main", title: tr(sf.tenant.name || "Menú"), service_availability: ALL_DAY, category_ids: catIds }],
    categories: categories.map((c) => ({
      id: c.id,
      title: tr(c.name),
      entities: products.filter((p) => p.category_id === c.id).map((p) => ({ id: p.id })),
    })),
    items: products.map((p) => {
      const img = p.image_url && /^https?:\/\//.test(p.image_url) ? p.image_url : null;
      return {
        id: p.id,
        title: tr(p.name),
        ...(p.description ? { description: tr(p.description) } : {}),
        ...(img ? { image_url: img } : {}),
        price_info: { price: Math.max(0, Math.round((p.price || 0) * 100)), overrides: [] },
        tax_info: {},
      };
    }),
    modifier_groups: [],
  };
  return { menu, counts: { categories: categories.length, items: products.length } };
}

/** Lee el storeId de Uber Eats configurado para el local. */
async function uberStoreIdFor(restaurantId: string): Promise<string | null> {
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ecommerceConfig: true } });
  const ue = parseEcommerceConfig(r?.ecommerceConfig).ubereats;
  return ue?.enabled && ue?.storeId ? ue.storeId : null;
}

/** Arma + sube el menú del local a su tienda de Uber Eats. */
export async function syncStoreMenu(restaurantId: string): Promise<{ ok: boolean; status?: number; error?: string; counts?: { categories: number; items: number } }> {
  const storeId = await uberStoreIdFor(restaurantId);
  if (!storeId) return { ok: false, error: "El local no tiene Uber Eats activado / Store ID configurado" };
  const built = await buildUberMenu(restaurantId);
  if (!built) return { ok: false, error: "No se pudo armar el menú (sin carta)" };
  const res = await putStoreMenu(storeId, built.menu);
  if (!res.ok) return { ok: false, status: res.status, error: (res.body || "").slice(0, 300) || `HTTP ${res.status}` };
  return { ok: true, status: res.status, counts: built.counts };
}
