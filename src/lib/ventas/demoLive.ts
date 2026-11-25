import { prisma } from "@/lib/prisma";

export const DEMO_STAMP_GOAL = 5;

/** Programa de fidelidad de demostración para el local demo del lead (para que el dueño
 *  se inscriba desde su celular durante la demo). SOLO para restaurantes isDemo: si el
 *  local es real, no hace nada. No pisa un programa que ya exista. */
export async function ensureDemoLoyalty(slug: string | null, opts: { color: string; prize: string | null }) {
  if (!slug) return;
  const r = await prisma.restaurant.findUnique({ where: { slug }, select: { id: true, name: true, logoUrl: true, isDemo: true } });
  if (!r?.isDemo) return;
  const existing = await prisma.loyaltyProgram.findUnique({ where: { restaurantId: r.id }, select: { id: true } });
  if (existing) return;
  await prisma.loyaltyProgram.create({
    data: {
      restaurantId: r.id,
      name: `Tarjeta ${r.name}`,
      active: true,
      cardColorHex: opts.color,
      logoUrl: r.logoUrl,
      stampGoal: DEMO_STAMP_GOAL,
      rewards: [{ stamp: DEMO_STAMP_GOAL, reward: opts.prize ? `${opts.prize} gratis` : "Premio sorpresa" }],
      description: "Junta sellos con cada visita y gana premios.",
    },
  }).catch((e) => console.error("[ventas] demo loyalty", e));
}

/** Activa la tienda online del local demo del lead para el pedido de prueba: solo retiro en
 *  local y pago en efectivo (sin cobros ni despacho reales). SOLO restaurantes isDemo. */
export async function ensureDemoStore(slug: string | null, color: string) {
  if (!slug) return;
  const r = await prisma.restaurant.findUnique({ where: { slug }, select: { id: true, isDemo: true, ecommerceEnabled: true, ecommerceStoreConfig: true } });
  if (!r?.isDemo) return;
  const cfg = (r.ecommerceStoreConfig && typeof r.ecommerceStoreConfig === "object" && !Array.isArray(r.ecommerceStoreConfig)) ? (r.ecommerceStoreConfig as Record<string, unknown>) : {};
  if (r.ecommerceEnabled && cfg.demoStore === true) return; // ya preparada
  await prisma.restaurant.update({
    where: { id: r.id },
    data: {
      ecommerceEnabled: true,
      ecommerceStoreConfig: { ...cfg, demoStore: true, paymentMethods: ["efectivo"], pickupEnabled: true, deliveryEnabled: false, primaryColor: cfg.primaryColor ?? color } as object,
    },
  }).catch((e) => console.error("[ventas] demo store", e));
}
