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
export async function buildUberMenu(restaurantId: string): Promise<{ menu: UberMenuPayload; counts: { categories: number; items: number; options: number } } | null> {
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { slug: true } });
  if (!r?.slug) return null;
  const sf = await loadEcommerceStorefront(r.slug);
  if (!sf) return null;

  // Solo platos pedibles: visibles, no agotados, con nombre y precio > 0.
  const products = sf.products.filter((p) => !p.hidden && !p.is_sold_out && p.name && (p.price || 0) > 0);
  const usedCat = new Set(products.map((p) => p.category_id));
  const categories = sf.categories.filter((c) => usedCat.has(c.id));
  const catIds = categories.map((c) => c.id);

  // Modificadores (opciones). Grupos e ítems-opción se COMPARTEN entre platos
  // (vienen de plantillas) → se deduplican por id. Cada opción es un ítem aparte
  // (con su precio +delta ×100), fuera de categorías. Schema verificado en sandbox.
  const modGroups = new Map<string, unknown>();
  const optItems = new Map<string, unknown>();
  function collectMods(p: typeof products[number]): string[] {
    const ids: string[] = [];
    for (const g of p.option_groups || []) {
      if (!g.values?.length) continue;
      ids.push(g.id);
      if (!modGroups.has(g.id)) {
        const minP = Math.max(0, g.min_select || 0);
        const maxP = Math.max(1, minP, g.max_select > 0 ? g.max_select : g.values.length);
        modGroups.set(g.id, {
          id: g.id,
          title: tr(g.name),
          quantity_info: { quantity: { min_permitted: minP, max_permitted: maxP }, overrides: [] },
          modifier_options: g.values.map((v) => ({ id: v.id, type: "ITEM" })),
        });
      }
      for (const v of g.values) {
        if (!optItems.has(v.id)) {
          optItems.set(v.id, {
            id: v.id,
            title: tr(v.name),
            price_info: { price: Math.max(0, Math.round((v.price_delta || 0) * 100)), overrides: [] },
            tax_info: {},
          });
        }
      }
    }
    return ids;
  }

  const productItems = products.map((p) => {
    const img = p.image_url && /^https?:\/\//.test(p.image_url) ? p.image_url : null;
    const mgIds = collectMods(p);
    return {
      id: p.id,
      title: tr(p.name),
      ...(p.description ? { description: tr(p.description) } : {}),
      ...(img ? { image_url: img } : {}),
      price_info: { price: Math.max(0, Math.round((p.price || 0) * 100)), overrides: [] },
      tax_info: {},
      ...(mgIds.length ? { modifier_group_ids: { ids: mgIds, overrides: [] } } : {}),
    };
  });

  const menu: UberMenuPayload = {
    menus: [{ id: "menu_main", title: tr(sf.tenant.name || "Menú"), service_availability: ALL_DAY, category_ids: catIds }],
    categories: categories.map((c) => ({
      id: c.id,
      title: tr(c.name),
      entities: products.filter((p) => p.category_id === c.id).map((p) => ({ id: p.id })),
    })),
    items: [...productItems, ...optItems.values()],
    modifier_groups: [...modGroups.values()],
  };
  return { menu, counts: { categories: categories.length, items: productItems.length, options: optItems.size } };
}

/** Lee el storeId de Uber Eats configurado para el local. */
async function uberStoreIdFor(restaurantId: string): Promise<string | null> {
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ecommerceConfig: true } });
  const ue = parseEcommerceConfig(r?.ecommerceConfig).ubereats;
  return ue?.enabled && ue?.storeId ? ue.storeId : null;
}

/** Arma + sube el menú del local a su tienda de Uber Eats. */
export async function syncStoreMenu(restaurantId: string): Promise<{ ok: boolean; status?: number; error?: string; counts?: { categories: number; items: number; options: number } }> {
  const storeId = await uberStoreIdFor(restaurantId);
  if (!storeId) return { ok: false, error: "El local no tiene Uber Eats activado / Store ID configurado" };
  const built = await buildUberMenu(restaurantId);
  if (!built) return { ok: false, error: "No se pudo armar el menú (sin carta)" };
  const res = await putStoreMenu(storeId, built.menu);
  if (!res.ok) return { ok: false, status: res.status, error: (res.body || "").slice(0, 300) || `HTTP ${res.status}` };
  return { ok: true, status: res.status, counts: built.counts };
}
