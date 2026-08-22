// ═══════════════════════════════════════════════════════════
//  Storefront del Ecommerce — carga y mapea los datos del
//  restaurante (Restaurant / Category / Dish) al shape que
//  usa el diseño clásico 1.0 (portado de Servio).
// ═══════════════════════════════════════════════════════════
import { prisma } from "@/lib/prisma";
import { parseDeliveryZones, type DeliveryZone } from "@/lib/ecommerce/delivery";

export interface StoreTenant {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  primaryColor: string;
  address: string | null;
  whatsapp: string | null;
  phone: string | null;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  waitTime: string | null;
  minAmount: number | null;
  paymentMethods: string[];
  deliveryZones: DeliveryZone[]; // solo zonas activas
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

const DEFAULT_PRIMARY = "#e63946";

/** Solo el tenant (para el checkout), sin cargar el catálogo. */
export async function loadEcommerceTenant(slug: string): Promise<StoreTenant | null> {
  const r = await prisma.restaurant.findUnique({
    where: { slug },
    select: {
      id: true, slug: true, name: true, logoUrl: true, orderingBannerUrl: true,
      cartaAccentColor: true, address: true, whatsapp: true, phone: true,
      orderingDelivery: true, orderingWaitTime: true, orderingMinAmount: true,
      orderingPaymentMethods: true, ecommerceEnabled: true, ecommerceDeliveryZones: true,
    },
  });
  if (!r || !r.ecommerceEnabled) return null;
  return {
    id: r.id, slug: r.slug, name: r.name, logoUrl: r.logoUrl, bannerUrl: r.orderingBannerUrl,
    primaryColor: r.cartaAccentColor || DEFAULT_PRIMARY, address: r.address, whatsapp: r.whatsapp, phone: r.phone,
    deliveryEnabled: !!r.orderingDelivery, pickupEnabled: true,
    waitTime: r.orderingWaitTime, minAmount: r.orderingMinAmount ?? null,
    paymentMethods: (r.orderingPaymentMethods || "").split(",").map((s) => s.trim()).filter(Boolean),
    deliveryZones: parseDeliveryZones(r.ecommerceDeliveryZones).filter((z) => z.active),
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
      orderingPaymentMethods: true, ecommerceEnabled: true, ecommerceDeliveryZones: true,
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

  const paymentMethods = (restaurant.orderingPaymentMethods || "").split(",").map((s) => s.trim()).filter(Boolean);

  return {
    tenant: {
      id: restaurant.id,
      slug: restaurant.slug,
      name: restaurant.name,
      logoUrl: restaurant.logoUrl,
      bannerUrl: restaurant.orderingBannerUrl,
      primaryColor: restaurant.cartaAccentColor || DEFAULT_PRIMARY,
      address: restaurant.address,
      whatsapp: restaurant.whatsapp,
      phone: restaurant.phone,
      deliveryEnabled: !!restaurant.orderingDelivery,
      pickupEnabled: true,
      waitTime: restaurant.orderingWaitTime,
      minAmount: restaurant.orderingMinAmount ?? null,
      paymentMethods,
      deliveryZones: parseDeliveryZones(restaurant.ecommerceDeliveryZones).filter((z) => z.active),
    },
    categories: storeCategories,
    products,
  };
}
