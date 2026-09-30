import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseStoreConfig } from "@/lib/ecommerce/store-config";
import { parseHours } from "@/lib/ecommerce/hours";
import { generateSlots, parseWaitMinutes } from "@/lib/ecommerce/scheduling";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/ecommerce/schedule-slots?restaurantId=X[&slug=Y]&type=DELIVERY|PICKUP
 *  Devuelve si el local acepta pedidos programados y las franjas disponibles. */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const type = req.nextUrl.searchParams.get("type") === "DELIVERY" ? "DELIVERY" : "PICKUP";
  if (!restaurantId && !slug) return NextResponse.json({ error: "restaurante requerido" }, { status: 400 });

  const sel = { ecommerceStoreConfig: true, ecommerceHours: true, cartaAccentColor: true } as const;
  const r = await (restaurantId
    ? prisma.restaurant.findUnique({ where: { id: restaurantId }, select: sel })
    : prisma.restaurant.findUnique({ where: { slug }, select: sel }));
  if (!r) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const store = parseStoreConfig(r.ecommerceStoreConfig, { accent: r.cartaAccentColor });
  if (!store.scheduledOrdersEnabled) {
    return NextResponse.json({ enabled: false, days: [] });
  }
  const hours = parseHours(r.ecommerceHours);
  const estimatedMinutes = parseWaitMinutes(type === "DELIVERY" ? store.waitTimeDelivery : store.waitTimePickup);
  const days = generateSlots({ hours, maxDaysAhead: store.scheduleMaxDaysAhead, estimatedMinutes });

  return NextResponse.json({ enabled: true, maxDaysAhead: store.scheduleMaxDaysAhead, estimatedMinutes, days });
}
