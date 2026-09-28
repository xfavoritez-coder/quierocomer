import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncRestaurantDishDiscounts } from "@/lib/promos/syncDishDiscounts";
import { syncPromoStoreProductsActive } from "@/lib/promos/promoStoreProduct";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Cron diario (medianoche de Chile): reevalúa Dish.discountPrice de cada restaurante
 * con promociones para que las ofertas por día de la semana (o con rango de fechas)
 * se enciendan/apaguen solas al cambiar el día. Protegido con CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Restaurantes con alguna promo ACTIVE (los únicos cuyo precio puede cambiar por día).
  const rows = await prisma.promotion.findMany({
    where: { status: "ACTIVE" },
    select: { restaurantId: true },
    distinct: ["restaurantId"],
  });

  let synced = 0;
  for (const r of rows) {
    try {
      await syncRestaurantDishDiscounts(r.restaurantId);
      await syncPromoStoreProductsActive(r.restaurantId); // enciende/apaga productos de promo por día/rango
      synced++;
    } catch { /* best-effort */ }
  }

  return NextResponse.json({ ok: true, restaurants: synced });
}
