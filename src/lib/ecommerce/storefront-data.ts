// ═══════════════════════════════════════════════════════════
//  Storefront del Ecommerce — carga y mapea los datos del
//  restaurante (Restaurant / Category / Dish) al shape que
//  usa el diseño clásico 1.0 (portado de Servio).
// ═══════════════════════════════════════════════════════════
import { prisma } from "@/lib/prisma";
import { parseDeliveryZones, parseDeliveryConfig, type DeliveryZone, type DeliveryConfig } from "@/lib/ecommerce/delivery";
import { parseEcommerceConfig } from "@/lib/ecommerce/config";
import { parseStoreConfig } from "@/lib/ecommerce/store-config";
import { parseAccompConfig, type AccompConfig } from "@/lib/ecommerce/accompaniments";
import { parseHours, getOpenStatus, type OpenStatus } from "@/lib/ecommerce/hours";

export interface StoreTenant {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  primaryColor: string;
  headerBgColor: string;
  categoryColor: string;
  notesEnabled: boolean;
  address: string | null;
  whatsapp: string | null;
  phone: string | null;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  waitTime: string | null;
  minAmount: number | null;
  paymentMethods: string[];
  deliveryZones: DeliveryZone[]; // solo zonas activas (modo "zones")
  deliveryConfig: DeliveryConfig; // modo "distance" (polígono + km)
  googleMapsKey: string | null; // key de navegador para autocompletar direcciones
  accompaniments: AccompConfig; // acompañamientos del checkout
  openStatus: OpenStatus; // estado abierto/cerrado según horario
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
  price: number;
  original_price: number | null; // precio tachado (si hay oferta)
  image_url: string | null;
  is_sold_out: boolean;
  toteat_code: string | null;
  option_groups: StoreOptionGroup[];
}

export interface StorefrontData {
  tenant: StoreTenant;
  categories: StoreCategory[];
  products: StoreProduct[];
}


/** Solo el tenant (para el checkout), sin cargar el catálogo. */
export async function loadEcommerceTenant(slug: string): Promise<StoreTenant | null> {
  const r = await prisma.restaurant.findUnique({
    where: { slug },
    select: {
      id: true, slug: true, name: true, logoUrl: true, orderingBannerUrl: true,
      cartaAccentColor: true, address: true, whatsapp: true, phone: true,
      orderingDelivery: true, orderingWaitTime: true, orderingMinAmount: true,
      orderingPaymentMethods: true, ecommerceEnabled: true, ecommerceDeliveryZones: true, ecommerceDeliveryConfig: true, ecommerceConfig: true, ecommerceStoreConfig: true, ecommerceAccompaniments: true, ecommerceHours: true,
    },
  });
  if (!r || !r.ecommerceEnabled) return null;
  const store = parseStoreConfig(r.ecommerceStoreConfig, { accent: r.cartaAccentColor, paymentMethods: (r.orderingPaymentMethods || "").split(",").map((s) => s.trim()).filter(Boolean) });
  return {
    id: r.id, slug: r.slug, name: r.name, logoUrl: r.logoUrl, bannerUrl: r.orderingBannerUrl,
    primaryColor: store.primaryColor, headerBgColor: store.headerBgColor, categoryColor: store.categoryColor, notesEnabled: store.notesEnabled,
    address: r.address, whatsapp: r.whatsapp, phone: r.phone,
    deliveryEnabled: !!r.orderingDelivery, pickupEnabled: true,
    waitTime: r.orderingWaitTime, minAmount: r.orderingMinAmount ?? null,
    paymentMethods: store.paymentMethods,
    deliveryZones: parseDeliveryZones(r.ecommerceDeliveryZones).filter((z) => z.active),
    deliveryConfig: parseDeliveryConfig(r.ecommerceDeliveryConfig),
    googleMapsKey: parseEcommerceConfig(r.ecommerceConfig).googleMaps?.apiKey || null,
    accompaniments: parseAccompConfig(r.ecommerceAccompaniments),
    openStatus: getOpenStatus(parseHours(r.ecommerceHours)),
  };
}

/**
 * Carga los datos del storefront para un restaurante con Ecommerce activado.
 * Devuelve null si el local no existe o no tiene el pilar habilitado.
 */
export async function loadEcommerceStorefront(slug: string): Promise<StorefrontData | null> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    select: {
      id: true, slug: true, name: true, logoUrl: true, orderingBannerUrl: true,
      cartaAccentColor: true, address: true, whatsapp: true, phone: true,
      orderingDelivery: true, orderingWaitTime: true, orderingMinAmount: true,
      orderingPaymentMethods: true, ecommerceEnabled: true, ecommerceDeliveryZones: true, ecommerceDeliveryConfig: true, ecommerceConfig: true, ecommerceStoreConfig: true, ecommerceAccompaniments: true, ecommerceHours: true,
    },
  });

  if (!restaurant || !restaurant.ecommerceEnabled) return null;

  const categories = await prisma.category.findMany({
    where: { restaurantId: restaurant.id, isActive: true },
    orderBy: { position: "asc" },
    select: {
      id: true, name: true, position: true,
      dishes: {
        where: { isActive: true, deletedAt: null },
        orderBy: { position: "asc" },
        select: {
          id: true, categoryId: true, name: true, description: true,
          price: true, discountPrice: true, photos: true, stockCountdown: true,
          toteatProductId: true,
          modifierTemplates: {
            select: {
              groups: {
                orderBy: { position: "asc" },
                select: {
                  id: true, name: true, required: true, minSelect: true, maxSelect: true, position: true,
                  options: {
                    where: { isHidden: false },
                    orderBy: { position: "asc" },
                    select: { id: true, name: true, priceAdjustment: true, toteatProductId: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const storeCategories: StoreCategory[] = [];
  const products: StoreProduct[] = [];

  for (const cat of categories) {
    if (!cat.dishes.length) continue;
    storeCategories.push({ id: cat.id, name: cat.name, position: cat.position });
    for (const d of cat.dishes) {
      // discountPrice es el precio de oferta (menor). Si existe y es menor,
      // el precio actual es la oferta y el original queda tachado.
      const hasOffer = d.discountPrice != null && d.discountPrice > 0 && d.discountPrice < d.price;

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
            })),
          });
        }
      }

      products.push({
        id: d.id,
        category_id: d.categoryId,
        name: d.name,
        description: d.description,
        price: hasOffer ? d.discountPrice! : d.price,
        original_price: hasOffer ? d.price : null,
        image_url: d.photos?.[0] ?? null,
        is_sold_out: d.stockCountdown != null && d.stockCountdown <= 0,
        toteat_code: d.toteatProductId ?? null,
        option_groups: optionGroups,
      });
    }
  }

  const fallbackMethods = (restaurant.orderingPaymentMethods || "").split(",").map((s) => s.trim()).filter(Boolean);
  const store = parseStoreConfig(restaurant.ecommerceStoreConfig, { accent: restaurant.cartaAccentColor, paymentMethods: fallbackMethods });

  return {
    tenant: {
      id: restaurant.id,
      slug: restaurant.slug,
      name: restaurant.name,
      logoUrl: restaurant.logoUrl,
      bannerUrl: restaurant.orderingBannerUrl,
      primaryColor: store.primaryColor,
      headerBgColor: store.headerBgColor,
      categoryColor: store.categoryColor,
      notesEnabled: store.notesEnabled,
      address: restaurant.address,
      whatsapp: restaurant.whatsapp,
      phone: restaurant.phone,
      deliveryEnabled: !!restaurant.orderingDelivery,
      pickupEnabled: true,
      waitTime: restaurant.orderingWaitTime,
      minAmount: restaurant.orderingMinAmount ?? null,
      paymentMethods: store.paymentMethods,
      deliveryZones: parseDeliveryZones(restaurant.ecommerceDeliveryZones).filter((z) => z.active),
      deliveryConfig: parseDeliveryConfig(restaurant.ecommerceDeliveryConfig),
      googleMapsKey: parseEcommerceConfig(restaurant.ecommerceConfig).googleMaps?.apiKey || null,
      accompaniments: parseAccompConfig(restaurant.ecommerceAccompaniments),
      openStatus: getOpenStatus(parseHours(restaurant.ecommerceHours)),
    },
    categories: storeCategories,
    products,
  };
}
