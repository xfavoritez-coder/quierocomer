// ═══════════════════════════════════════════════════════════
//  Storefront del Ecommerce — carga y mapea los datos del
//  restaurante (Restaurant / Category / Dish) al shape que
//  usa el diseño clásico 1.0 (portado de Servio).
// ═══════════════════════════════════════════════════════════
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseDeliveryZones, parseDeliveryConfig, type DeliveryZone, type DeliveryConfig } from "@/lib/ecommerce/delivery";
import { parseEcommerceConfig } from "@/lib/ecommerce/config";
import { parseStoreConfig } from "@/lib/ecommerce/store-config";
import type { Prisma } from "@prisma/client";
import { parseAccompConfig, type AccompConfig } from "@/lib/ecommerce/accompaniments";
import { parseHours, resolveAvailability, DAY_KEYS, type OpenStatus, type DayHours } from "@/lib/ecommerce/hours";
import { activeHappyHours, bestHappyHourPrice, appliesToChannel } from "@/lib/happyHour";

export interface StoreTenant {
  id: string;
  slug: string;
  name: string;
  branchName: string | null; // nombre de sucursal dentro de la marca (ej. "Recoleta")
  logoUrl: string | null;
  bannerUrl: string | null;
  primaryColor: string;
  headerBgColor: string;
  categoryColor: string;
  notesEnabled: boolean;
  posShowDescriptions: boolean; // mostrar descripción de productos en "Tomar pedidos"
  address: string | null;
  whatsapp: string | null;
  phone: string | null;
  instagram: string | null;
  website: string | null;
  contactEmail: string | null;
  // Overrides para la página de Política de Privacidad (null = usa address/whatsapp/contactEmail).
  privacyEmail: string | null;
  privacyPhone: string | null;
  privacyAddress: string | null;
  favoritesEnabled: boolean;
  theme: "base" | "impact"; // tema visual del storefront
  bannerProductIds: string[]; // productos destacados del banner (tema impact)
  customDomain: string | null; // dominio propio de la tienda (null = usa quierocomer.com/ecommerce/<slug>)
  faviconUrl: string | null; // favicon propio (null = usa el logo)
  gtmId: string | null; // Google Tag Manager container id (null = sin GTM)
  metaPixelId: string | null; // Meta (Facebook) Pixel ID (null = sin Pixel)
  pageTitle: string | null; // <title> personalizado (null = default)
  metaDescription: string | null; // meta description personalizada (null = default)
  brandSlug: string | null; // marca multisucursal (null = tienda independiente)
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  waitTime: string | null;
  waitTimePickup: string; // tiempo estimado retiro
  waitTimeDelivery: string; // tiempo estimado delivery
  minAmount: number | null;
  minOrderPickup: number; // mínimo de compra para retiro (0 = sin mínimo)
  minOrderDelivery: number; // mínimo de compra para delivery (0 = sin mínimo)
  paymentMethods: string[];
  deliveryZones: DeliveryZone[]; // solo zonas activas (modo "zones")
  deliveryConfig: DeliveryConfig; // modo "distance" (polígono + km)
  googleMapsKey: string | null; // key de navegador para autocompletar direcciones
  accompaniments: AccompConfig; // acompañamientos del checkout
  openStatus: OpenStatus; // estado abierto/cerrado según horario
  weeklyHours: DayHours[] | null; // horario semanal (índice 0=Dom … 6=Sáb); null = siempre abierto (sin horario)
  scheduledOrdersEnabled: boolean; // el local acepta pedidos programados
  scheduleMaxDaysAhead: number; // días hacia adelante que se puede programar
  showTableMenu: boolean; // mostrar "Carta mesa" en el menú (link a /qr/<slug>)
}

export interface StoreCategory {
  id: string;
  name: string;
  position: number;
}

export interface StoreOptionValue {
  id: string;
  name: string;
  price_delta: number;
  toteat_modifier_code: string | null;
  is_sold_out: boolean;
}

export interface StoreOptionGroup {
  id: string;
  name: string;
  is_required: boolean;
  min_select: number;
  max_select: number;
  values: StoreOptionValue[];
}

export interface StoreProduct {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  detailed_description: string | null; // descripción larga (lista tipo "Incluye")
  price: number;
  original_price: number | null; // precio tachado (si hay oferta)
  is_happy_hour?: boolean; // el precio vigente viene de un happy hour activo
  image_url: string | null;
  is_sold_out: boolean;
  is_hero: boolean; // destacado (para el banner del tema impact)
  toteat_code: string | null;
  hidden?: boolean; // inactivo/oculto para el cliente (solo en gestión de carta)
  option_groups: StoreOptionGroup[];
  promo_id?: string | null; // oferta activa hoy sobre este plato (para analytics)
}

export interface StorefrontData {
  tenant: StoreTenant;
  categories: StoreCategory[];
  products: StoreProduct[];
}


// ── Precio y disponibilidad vigentes de un plato ───────────────────────────
// Extraído para compartir la MISMA lógica entre la carga completa del catálogo
// (cacheada) y la capa "en vivo" (loadEcommerceLive), y que no diverjan.
type ActiveHHs = ReturnType<typeof activeHappyHours>;
export function dishEffectivePricing(
  d: { id: string; categoryId: string; price: number; discountPrice: number | null },
  activeHHs: ActiveHHs,
): { price: number; original_price: number | null; is_happy_hour: boolean } {
  // discountPrice = oferta (menor). Happy hour (si activo) compite: gana el menor.
  const offer = d.discountPrice != null && d.discountPrice > 0 && d.discountPrice < d.price ? d.discountPrice : null;
  const hhPrice = activeHHs.length ? bestHappyHourPrice({ id: d.id, categoryId: d.categoryId, price: d.price }, activeHHs) : null;
  const effective = Math.min(offer ?? d.price, hhPrice ?? d.price);
  const hasOffer = effective < d.price;
  return { price: hasOffer ? effective : d.price, original_price: hasOffer ? d.price : null, is_happy_hour: hhPrice != null };
}
export function dishSoldOut(d: { soldOut: boolean | null; stockCountdown: number | null }): boolean {
  return d.soldOut === true || (d.stockCountdown != null && d.stockCountdown <= 0);
}

// Resuelve el restaurante por su `slug` (dominio principal) o por su dominio propio
// guardado en ecommerceStoreConfig.customDomain (cuando el request llega por haruna.cl).
// `key` es el slug o el host, según de dónde venga la request (lo decide el middleware).
function restaurantByKey(key: string): Prisma.RestaurantWhereInput {
  return { OR: [{ slug: key }, { ecommerceStoreConfig: { path: ["customDomain"], equals: key } }] };
}

/** Devuelve el brandSlug de un local sin tocar el cache (para page.tsx como fallback). */
export async function loadBrandSlugForSlug(key: string): Promise<string | null> {
  const r = await prisma.restaurant.findFirst({ where: restaurantByKey(key), select: { ecommerceStoreConfig: true } });
  return parseStoreConfig(r?.ecommerceStoreConfig).brandSlug;
}

/** Solo el tenant (para el checkout), sin cargar el catálogo. */
export async function loadEcommerceTenant(slug: string): Promise<StoreTenant | null> {
  const r = await prisma.restaurant.findFirst({
    where: restaurantByKey(slug),
    select: {
      id: true, slug: true, name: true, logoUrl: true, orderingBannerUrl: true,
      cartaAccentColor: true, address: true, whatsapp: true, phone: true, instagram: true, website: true,
      owner: { select: { email: true } },
      orderingDelivery: true, orderingWaitTime: true, orderingMinAmount: true,
      orderingPaymentMethods: true, ecommerceEnabled: true, ecommerceDeliveryZones: true, ecommerceDeliveryConfig: true, ecommerceConfig: true, ecommerceStoreConfig: true, ecommerceAccompaniments: true, ecommerceHours: true,
    },
  });
  if (!r || !r.ecommerceEnabled) return null;
  const store = parseStoreConfig(r.ecommerceStoreConfig, { accent: r.cartaAccentColor, paymentMethods: (r.orderingPaymentMethods || "").split(",").map((s) => s.trim()).filter(Boolean), minOrder: r.orderingMinAmount ?? null, waitTime: r.orderingWaitTime });
  const hours = parseHours(r.ecommerceHours);
  const avail = resolveAvailability(hours, { deliveryEnabled: store.deliveryEnabled, pickupEnabled: store.pickupEnabled });
  return {
    id: r.id, slug: r.slug, name: r.name, branchName: store.branchName, logoUrl: store.storeLogoUrl ?? r.logoUrl, bannerUrl: store.bannerUrl ?? r.orderingBannerUrl,
    primaryColor: store.primaryColor, headerBgColor: store.headerBgColor, categoryColor: store.categoryColor, notesEnabled: store.notesEnabled, posShowDescriptions: store.posShowDescriptions,
    address: r.address, whatsapp: r.whatsapp, phone: r.phone,
    instagram: r.instagram, website: r.website, contactEmail: r.owner?.email ?? null, privacyEmail: store.privacyEmail, privacyPhone: store.privacyPhone, privacyAddress: store.privacyAddress, favoritesEnabled: store.favoritesEnabled, theme: store.theme, bannerProductIds: store.bannerProductIds, customDomain: store.customDomain, faviconUrl: store.faviconUrl, gtmId: store.gtmId, metaPixelId: store.metaPixelId, pageTitle: store.pageTitle, metaDescription: store.metaDescription, brandSlug: store.brandSlug,
    deliveryEnabled: avail.deliveryEnabled, pickupEnabled: avail.pickupEnabled,
    waitTime: r.orderingWaitTime, waitTimePickup: store.waitTimePickup, waitTimeDelivery: store.waitTimeDelivery, minAmount: r.orderingMinAmount ?? null, minOrderPickup: store.minOrderPickup, minOrderDelivery: store.minOrderDelivery,
    paymentMethods: store.paymentMethods,
    deliveryZones: parseDeliveryZones(r.ecommerceDeliveryZones).filter((z) => z.active),
    deliveryConfig: parseDeliveryConfig(r.ecommerceDeliveryConfig),
    googleMapsKey: parseEcommerceConfig(r.ecommerceConfig).googleMaps?.apiKey || null,
    accompaniments: parseAccompConfig(r.ecommerceAccompaniments),
    openStatus: avail.openStatus,
    weeklyHours: hours.enabled ? DAY_KEYS.map((k) => hours.days[k]) : null,
    scheduledOrdersEnabled: store.scheduledOrdersEnabled,
    scheduleMaxDaysAhead: store.scheduleMaxDaysAhead,
    showTableMenu: store.showTableMenu,
  };
}

/**
 * Carga los datos del storefront para un restaurante con Ecommerce activado.
 * Devuelve null si el local no existe o no tiene el pilar habilitado.
 */
export async function loadEcommerceStorefront(slug: string, opts?: { includeHidden?: boolean; fromApp?: boolean }): Promise<StorefrontData | null> {
  // includeHidden: incluye categorías/productos/modificadores inactivos u ocultos
  // (para la gestión de carta en el panel: p. ej. asignar códigos Toteat a
  // productos que aún no están activos o son ofertas de otro día). El storefront
  // público llama sin esto → sigue mostrando solo lo activo.
  // fromApp: la request viene desde la app nativa (cookie qc_app). Solo entonces
  // se muestran los platos marcados como appOnly (ver Dish.appOnly) — en la web
  // normal quedan ocultos para que sean exclusivos de la app.
  const includeHidden = opts?.includeHidden === true;
  const fromApp = opts?.fromApp === true;
  const restaurant = await prisma.restaurant.findFirst({
    where: restaurantByKey(slug),
    select: {
      id: true, slug: true, name: true, logoUrl: true, orderingBannerUrl: true,
      cartaAccentColor: true, address: true, whatsapp: true, phone: true, instagram: true, website: true,
      owner: { select: { email: true } },
      orderingDelivery: true, orderingWaitTime: true, orderingMinAmount: true,
      orderingPaymentMethods: true, ecommerceEnabled: true, ecommerceDeliveryZones: true, ecommerceDeliveryConfig: true, ecommerceConfig: true, ecommerceStoreConfig: true, ecommerceAccompaniments: true, ecommerceHours: true,
      happyHours: { where: { isActive: true }, select: { id: true, name: true, days: true, startTime: true, endTime: true, discountType: true, discountValue: true, categoryIds: true, dishIds: true, channels: true, bannerText: true, bannerColor: true, isActive: true } },
    },
  });

  if (!restaurant || !restaurant.ecommerceEnabled) return null;

  // Happy hours activos ahora para el canal ecommerce (puede haber varios a la
  // vez; cada producto toma el mejor). No se aplica en modo gestión de carta.
  const activeHHs = includeHidden ? [] : activeHappyHours((restaurant.happyHours as any[]).filter((h) => appliesToChannel(h, "ecommerce")));

  const categories = await prisma.category.findMany({
    where: { restaurantId: restaurant.id, ...(includeHidden ? {} : { isActive: true }) },
    orderBy: { position: "asc" },
    select: {
      id: true, name: true, position: true, isActive: true,
      dishes: {
        // hideFromOrdering: platos ocultos de "Pedidos online" no se muestran en la tienda.
        // includeHidden (gestión de carta) sí los trae, pero nunca los borrados.
        where: includeHidden ? { deletedAt: null } : { isActive: true, deletedAt: null, hideFromOrdering: false, ...(fromApp ? {} : { appOnly: false }) },
        orderBy: { position: "asc" },
        select: {
          id: true, categoryId: true, name: true, description: true, detailedDescription: true,
          price: true, discountPrice: true, photos: true, stockCountdown: true, soldOut: true,
          toteatProductId: true, isHero: true, isActive: true, hideFromOrdering: true, daysOfWeek: true,
          modifierTemplates: {
            select: {
              groups: {
                orderBy: { position: "asc" },
                select: {
                  id: true, name: true, required: true, minSelect: true, maxSelect: true, position: true,
                  options: {
                    where: includeHidden ? {} : { isHidden: false },
                    orderBy: { position: "asc" },
                    select: { id: true, name: true, priceAdjustment: true, toteatProductId: true, soldOut: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  // Promos activas hoy: aplicar nombre/precio override y guardar promo_id en el pedido
  type ActivePromo = { id: string; dishId: string; promoName: string | null; promoPrice: number | null; originalPrice: number | null };
  const promoByDishId = new Map<string, ActivePromo>();
  const now = new Date();
  const todayDow = new Date(now.toLocaleString("en-US", { timeZone: "America/Santiago" })).getDay();
  if (!includeHidden) {
    const activePromos = await (prisma as any).promotion.findMany({
      where: {
        restaurantId: restaurant.id,
        status: "ACTIVE",
        dishId: { not: null },
        OR: [{ validUntil: null }, { validUntil: { gt: now } }],
      },
      select: { id: true, dishId: true, promoName: true, promoPrice: true, originalPrice: true, daysOfWeek: true, validFrom: true },
    }).then((promos: any[]) => promos.filter((p: any) => {
      if (p.validFrom && new Date(p.validFrom) > now) return false;
      if (p.daysOfWeek?.length > 0 && !p.daysOfWeek.includes(todayDow)) return false;
      return true;
    }));
    for (const p of activePromos) promoByDishId.set(p.dishId, p);
  }

  const storeCategories: StoreCategory[] = [];
  const products: StoreProduct[] = [];

  for (const cat of categories) {
    // Filtro por día: Dish.daysOfWeek ("mostrar solo estos días"). En gestión de
    // carta (includeHidden) se muestran todos; en la tienda se oculta el plato los
    // días no incluidos, igual que en la carta QR (getRestaurant.ts).
    const visibleDishes = includeHidden
      ? cat.dishes
      : cat.dishes.filter((d: any) => !d.daysOfWeek?.length || d.daysOfWeek.includes(todayDow));
    if (!visibleDishes.length) continue;
    storeCategories.push({ id: cat.id, name: cat.name, position: cat.position });
    for (const d of visibleDishes) {
      // Precio/oferta/happy hour vigentes (lógica compartida con loadEcommerceLive).
      const pricing = dishEffectivePricing(d, activeHHs);
      const activePromo = promoByDishId.get(d.id);

      // Override de nombre y precio si hay una oferta activa hoy
      const displayName = activePromo?.promoName || d.name;
      const displayPricing = activePromo?.promoPrice != null
        ? { price: activePromo.promoPrice, original_price: activePromo.originalPrice ?? d.price, is_happy_hour: false }
        : pricing;

      // Aplanar los grupos de modificadores de todas las plantillas del plato.
      const optionGroups: StoreOptionGroup[] = [];
      for (const tpl of d.modifierTemplates) {
        for (const g of tpl.groups) {
          if (!g.options.length) continue;
          optionGroups.push({
            id: g.id,
            name: g.name,
            is_required: g.required || g.minSelect > 0,
            min_select: g.minSelect,
            max_select: g.maxSelect,
            values: g.options.map((o) => ({
              id: o.id,
              name: o.name,
              price_delta: o.priceAdjustment,
              toteat_modifier_code: o.toteatProductId ?? null,
              is_sold_out: o.soldOut === true,
            })),
          });
        }
      }

      products.push({
        id: d.id,
        category_id: d.categoryId,
        name: displayName,
        description: d.description,
        detailed_description: d.detailedDescription ?? null,
        price: displayPricing.price,
        original_price: displayPricing.original_price,
        is_happy_hour: displayPricing.is_happy_hour,
        image_url: d.photos?.[0] ?? null,
        is_sold_out: dishSoldOut(d),
        is_hero: d.isHero === true,
        toteat_code: d.toteatProductId ?? null,
        // Oculto para el cliente: categoría inactiva, plato inactivo u oculto de
        // "Pedidos online". Solo se puebla con includeHidden (gestión de carta).
        hidden: !cat.isActive || d.isActive === false || d.hideFromOrdering === true,
        option_groups: optionGroups,
        promo_id: activePromo?.id ?? null,
      });
    }
  }

  const fallbackMethods = (restaurant.orderingPaymentMethods || "").split(",").map((s) => s.trim()).filter(Boolean);
  const store = parseStoreConfig(restaurant.ecommerceStoreConfig, { accent: restaurant.cartaAccentColor, paymentMethods: fallbackMethods, minOrder: restaurant.orderingMinAmount ?? null, waitTime: restaurant.orderingWaitTime });
  const hours = parseHours(restaurant.ecommerceHours);
  const avail = resolveAvailability(hours, { deliveryEnabled: store.deliveryEnabled, pickupEnabled: store.pickupEnabled });

  return {
    tenant: {
      id: restaurant.id,
      slug: restaurant.slug,
      name: restaurant.name,
      branchName: store.branchName,
      logoUrl: store.storeLogoUrl ?? restaurant.logoUrl,
      bannerUrl: store.bannerUrl ?? restaurant.orderingBannerUrl,
      primaryColor: store.primaryColor,
      headerBgColor: store.headerBgColor,
      categoryColor: store.categoryColor,
      notesEnabled: store.notesEnabled,
      posShowDescriptions: store.posShowDescriptions,
      address: restaurant.address,
      whatsapp: restaurant.whatsapp,
      phone: restaurant.phone,
      instagram: restaurant.instagram,
      website: restaurant.website,
      contactEmail: restaurant.owner?.email ?? null,
      privacyEmail: store.privacyEmail,
      privacyPhone: store.privacyPhone,
      privacyAddress: store.privacyAddress,
      favoritesEnabled: store.favoritesEnabled,
      theme: store.theme,
      bannerProductIds: store.bannerProductIds,
      customDomain: store.customDomain,
      faviconUrl: store.faviconUrl,
      gtmId: store.gtmId,
      metaPixelId: store.metaPixelId,
      pageTitle: store.pageTitle,
      metaDescription: store.metaDescription,
      brandSlug: store.brandSlug,
      deliveryEnabled: avail.deliveryEnabled,
      pickupEnabled: avail.pickupEnabled,
      waitTime: restaurant.orderingWaitTime,
      waitTimePickup: store.waitTimePickup,
      waitTimeDelivery: store.waitTimeDelivery,
      minAmount: restaurant.orderingMinAmount ?? null,
      minOrderPickup: store.minOrderPickup,
      minOrderDelivery: store.minOrderDelivery,
      paymentMethods: store.paymentMethods,
      deliveryZones: parseDeliveryZones(restaurant.ecommerceDeliveryZones).filter((z) => z.active),
      deliveryConfig: parseDeliveryConfig(restaurant.ecommerceDeliveryConfig),
      googleMapsKey: parseEcommerceConfig(restaurant.ecommerceConfig).googleMaps?.apiKey || null,
      accompaniments: parseAccompConfig(restaurant.ecommerceAccompaniments),
      openStatus: avail.openStatus,
    weeklyHours: hours.enabled ? DAY_KEYS.map((k) => hours.days[k]) : null,
    scheduledOrdersEnabled: store.scheduledOrdersEnabled,
    scheduleMaxDaysAhead: store.scheduleMaxDaysAhead,
    showTableMenu: store.showTableMenu,
    },
    categories: storeCategories,
    products,
  };
}

// ═══════════════════════════════════════════════════════════
//  Storefront cacheado (menú estático) + capa "en vivo" (agotados/horario/HH)
//  ───────────────────────────────────────────────────────────
//  Patrón espejo de la carta QR (getRestaurantBySlug + revalidateQrCache):
//  - El catálogo PESADO (categorías+platos+modificadores) se cachea con
//    unstable_cache por restaurante; se invalida al instante al editar el menú
//    (revalidateEcommerceCache) y, como red de seguridad, revalida cada 10 min.
//  - Lo VOLÁTIL (abierto/cerrado, agotados, precio de happy hour por horario) se
//    recalcula fresco con una consulta liviana (loadEcommerceLive) y se mezcla en
//    cada request → el storefront muestra disponibilidad al día sin recalcularla
//    dentro de la lectura del menú (equivalente al "/disableds" de Mercat).
// ═══════════════════════════════════════════════════════════

// Resuelve (cacheado) la clave (slug o dominio propio) → id del restaurante, para
// cachear el catálogo por id (una sola entrada aunque se entre por slug o por
// dominio propio) e invalidar por id desde el panel.
function resolveEcommerceTenant(key: string): Promise<{ id: string; slug: string } | null> {
  return unstable_cache(
    async () => {
      const r = await prisma.restaurant.findFirst({ where: restaurantByKey(key), select: { id: true, slug: true, ecommerceEnabled: true } });
      if (!r || !r.ecommerceEnabled) throw new Error("ecom not found: " + key);
      return { id: r.id, slug: r.slug };
    },
    ["ecom-resolve", key],
    { tags: ["ecom-resolve", `ecom-resolve-${key}`], revalidate: 600 },
  )().catch(() => null);
}

/**
 * Catálogo del storefront CACHEADO (menú "estático"). Devuelve el mismo shape que
 * loadEcommerceStorefront, pero servido desde la Data Cache (sin pegarle a la BD
 * en cada visita). La disponibilidad/precio por horario puede estar hasta 10 min
 * vieja aquí — getEcommerceStorefront() la refresca con la capa en vivo.
 */
export async function getEcommerceStorefrontBaseCached(key: string, opts?: { fromApp?: boolean }): Promise<StorefrontData | null> {
  const fromApp = opts?.fromApp === true;
  const resolved = await resolveEcommerceTenant(key);
  if (!resolved) return null;
  return unstable_cache(
    async () => {
      const r = await loadEcommerceStorefront(key, { fromApp });
      if (!r) throw new Error("ecom storefront not found: " + key); // no cachear "no existe"
      return r;
    },
    ["ecom-storefront", resolved.id, String(fromApp)],
    // Taggeado por id (invalidación directa del panel) y por slug (para que el mismo
    // revalidateQrCache(slug) que ya corre al editar el menú también lo invalide).
    { tags: ["ecom-storefront", `ecom-storefront-id-${resolved.id}`, `ecom-storefront-slug-${resolved.slug}`], revalidate: 600 },
  )().catch(() => null);
}

export interface StorefrontLive {
  openStatus: OpenStatus;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  // id de plato → precio/disponibilidad vigentes (solo los que difieren se mezclan)
  products: Record<string, { price: number; original_price: number | null; is_happy_hour: boolean; is_sold_out: boolean; promo_name?: string | null; promo_id?: string | null }>;
}

/**
 * Capa EN VIVO (liviana, sin cachear): estado abierto/cerrado, métodos
 * disponibles, agotados y precio de happy hour por horario. Consulta mínima
 * (sin modificadores) para no recalcular todo el menú en cada lectura.
 */
export async function loadEcommerceLive(key: string): Promise<StorefrontLive | null> {
  const r = await prisma.restaurant.findFirst({
    where: restaurantByKey(key),
    select: {
      id: true, cartaAccentColor: true, ecommerceEnabled: true, ecommerceStoreConfig: true, ecommerceHours: true,
      happyHours: { where: { isActive: true }, select: { id: true, name: true, days: true, startTime: true, endTime: true, discountType: true, discountValue: true, categoryIds: true, dishIds: true, channels: true, bannerText: true, bannerColor: true, isActive: true } },
      categories: {
        where: { isActive: true },
        select: { dishes: { where: { isActive: true, deletedAt: null, hideFromOrdering: false }, select: { id: true, categoryId: true, price: true, discountPrice: true, soldOut: true, stockCountdown: true } } },
      },
    },
  });
  if (!r || !r.ecommerceEnabled) return null;
  const store = parseStoreConfig(r.ecommerceStoreConfig, { accent: r.cartaAccentColor });
  const avail = resolveAvailability(parseHours(r.ecommerceHours), { deliveryEnabled: store.deliveryEnabled, pickupEnabled: store.pickupEnabled });
  const activeHHs = activeHappyHours((r.happyHours as any[]).filter((h) => appliesToChannel(h, "ecommerce")));

  // Promos activas hoy (igual lógica que loadEcommerceStorefront) para aplicar
  // nombre de promo en la capa en vivo (sin depender del caché).
  const now = new Date();
  const todayDow = new Date(now.toLocaleString("en-US", { timeZone: "America/Santiago" })).getDay();
  const livePromos = await (prisma as any).promotion.findMany({
    where: { restaurantId: r.id, status: "ACTIVE", dishId: { not: null }, OR: [{ validUntil: null }, { validUntil: { gt: now } }] },
    select: { id: true, dishId: true, promoName: true, promoPrice: true, originalPrice: true, daysOfWeek: true, validFrom: true },
  }).then((promos: any[]) => promos.filter((p: any) => {
    if (p.validFrom && new Date(p.validFrom) > now) return false;
    if (p.daysOfWeek?.length > 0 && !p.daysOfWeek.includes(todayDow)) return false;
    return true;
  }));
  const promoByDishIdLive = new Map<string, { id: string; promoName: string | null; promoPrice: number | null; originalPrice: number | null }>();
  for (const p of livePromos) promoByDishIdLive.set(p.dishId, p);

  const products: StorefrontLive["products"] = {};
  for (const c of r.categories) for (const d of c.dishes) {
    const promo = promoByDishIdLive.get(d.id);
    const pricing = promo?.promoPrice != null
      ? { price: promo.promoPrice, original_price: promo.originalPrice ?? d.price, is_happy_hour: false }
      : dishEffectivePricing(d, activeHHs);
    products[d.id] = { ...pricing, is_sold_out: dishSoldOut(d), promo_name: promo?.promoName ?? null, promo_id: promo?.id ?? null };
  }
  return { openStatus: avail.openStatus, deliveryEnabled: avail.deliveryEnabled, pickupEnabled: avail.pickupEnabled, products };
}

/**
 * Storefront para la página pública: catálogo cacheado + capa en vivo mezclada.
 * Si la capa en vivo falla, devuelve el catálogo cacheado tal cual (nunca rompe).
 */
export async function getEcommerceStorefront(key: string, opts?: { fromApp?: boolean }): Promise<StorefrontData | null> {
  const base = await getEcommerceStorefrontBaseCached(key, opts);
  if (!base) return null;
  let live: StorefrontLive | null = null;
  try { live = await loadEcommerceLive(key); } catch { live = null; }
  if (!live) return base;
  const tenant: StoreTenant = { ...base.tenant, openStatus: live.openStatus, deliveryEnabled: live.deliveryEnabled, pickupEnabled: live.pickupEnabled };
  const products = base.products.map((p) => {
    const o = live!.products[p.id];
    if (!o) return p;
    return {
      ...p,
      name: o.promo_name || p.name,
      price: o.price,
      original_price: o.original_price,
      is_happy_hour: o.is_happy_hour,
      is_sold_out: o.is_sold_out,
      promo_id: o.promo_id ?? p.promo_id,
    };
  });
  return { tenant, categories: base.categories, products };
}

// ═══════════════════════════════════════════════════════════
//  Marca multisucursal: varias tiendas con el mismo brandSlug
//  (ecommerceStoreConfig.brandSlug) son sucursales de una marca.
// ═══════════════════════════════════════════════════════════
export interface BrandBranch {
  id: string;
  slug: string;
  name: string;
  branchName: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  logoUrl: string | null;
  primaryColor: string;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  open: boolean;
}
export interface BrandData {
  brandSlug: string;
  brandName: string;
  logoUrl: string | null;
  googleMapsKey: string | null;
  branches: BrandBranch[];
  pageTitle: string | null;
  metaDescription: string | null;
  metaPixelId: string | null;
  gtmId: string | null;
}

/** Carga una marca y sus sucursales (locales ecommerce con el mismo brandSlug). */
export async function loadEcommerceBrand(brandSlug: string): Promise<BrandData | null> {
  const key = (brandSlug || "").trim().toLowerCase();
  if (!key) return null;
  const rows = await prisma.restaurant.findMany({
    where: { ecommerceEnabled: true, ecommerceStoreConfig: { path: ["brandSlug"], equals: key } },
    select: {
      id: true, slug: true, name: true, logoUrl: true, address: true, lat: true, lng: true,
      cartaAccentColor: true, ecommerceStoreConfig: true, ecommerceConfig: true,
      ecommerceHours: true, ecommerceDeliveryConfig: true,
    },
  });
  if (!rows.length) return null;

  const branches: BrandBranch[] = rows.map((r) => {
    const cfg = parseStoreConfig(r.ecommerceStoreConfig, { accent: r.cartaAccentColor });
    const dcfg = parseDeliveryConfig(r.ecommerceDeliveryConfig);
    const avail = resolveAvailability(parseHours(r.ecommerceHours), { deliveryEnabled: cfg.deliveryEnabled, pickupEnabled: cfg.pickupEnabled });
    return {
      id: r.id, slug: r.slug, name: r.name, branchName: cfg.branchName, address: r.address,
      lat: dcfg.origin?.lat ?? r.lat ?? null, lng: dcfg.origin?.lng ?? r.lng ?? null,
      logoUrl: r.logoUrl, primaryColor: cfg.primaryColor,
      pickupEnabled: cfg.pickupEnabled, deliveryEnabled: cfg.deliveryEnabled,
      open: avail.openStatus.open,
    };
  }).sort((a, b) => (a.branchName || a.name).localeCompare(b.branchName || b.name));

  const gmaps = parseEcommerceConfig(rows[0].ecommerceConfig).googleMaps?.apiKey || null;
  const allCfgs = rows.map((r) => parseStoreConfig(r.ecommerceStoreConfig, { accent: r.cartaAccentColor }));
  const firstCfg = allCfgs[0];
  return {
    brandSlug: key,
    brandName: branches[0]?.name || key,
    logoUrl: branches.find((b) => b.logoUrl)?.logoUrl ?? null,
    googleMapsKey: gmaps,
    branches,
    pageTitle: firstCfg.pageTitle,
    metaDescription: firstCfg.metaDescription,
    metaPixelId: allCfgs.find((c) => c.metaPixelId)?.metaPixelId ?? null,
    gtmId: allCfgs.find((c) => c.gtmId)?.gtmId ?? null,
  };
}

/**
 * Resuelve una MARCA por su dominio propio (ecommerceStoreConfig.brandDomain).
 * Lo usa el storefront cuando la request llega por un dominio de marca (ej. kojo.cl):
 * en vez de una tienda de un solo local, sirve la página de marca (elige sucursal).
 */
export async function loadEcommerceBrandByDomain(domain: string): Promise<BrandData | null> {
  const key = (domain || "").trim().toLowerCase().replace(/^www\./, "");
  if (!key || !key.includes(".")) return null; // solo hosts reales, no slugs
  const r = await prisma.restaurant.findFirst({
    where: { ecommerceEnabled: true, ecommerceStoreConfig: { path: ["brandDomain"], equals: key } },
    select: { ecommerceStoreConfig: true },
  });
  if (!r) return null;
  const brandSlug = parseStoreConfig(r.ecommerceStoreConfig).brandSlug;
  if (!brandSlug) return null;
  return loadEcommerceBrand(brandSlug);
}
