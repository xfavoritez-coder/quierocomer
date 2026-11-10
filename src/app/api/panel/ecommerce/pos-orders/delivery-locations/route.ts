import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { teamMemberCanAccess } from "@/lib/ecommerce/panelAuth";
import { chileTodayYmd, chileDayRangeUtc } from "@/lib/driver/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertOwnership(req: NextRequest, restaurantId: string): Promise<boolean> {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return false;
  if (panelId === "demo") return true;
  if (panelId.startsWith("tm_")) return teamMemberCanAccess(panelId.slice(3), restaurantId);
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  return r?.ownerId === panelId;
}

/** GET /api/panel/ecommerce/pos-orders/delivery-locations?restaurantId=X&from=YYYY-MM-DD&to=YYYY-MM-DD
 *  Devuelve las coordenadas de pedidos delivery con geolocalización del cliente,
 *  para el mapa de calor en /pos/reportes. */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const today = chileTodayYmd();
  const fromYmd = req.nextUrl.searchParams.get("from") || today;
  const toYmd = req.nextUrl.searchParams.get("to") || fromYmd;
  const start = chileDayRangeUtc(fromYmd).start;
  const end = chileDayRangeUtc(toYmd).end;

  const orders = await prisma.posOrder.findMany({
    where: {
      restaurantId,
      posStatus: { not: "canceled" },
      isDelivery: true,
      customerLat: { not: null },
      customerLng: { not: null },
      createdAt: { gte: start, lte: end },
    },
    select: { customerLat: true, customerLng: true, totalAmount: true, deliveryFee: true, tipAmount: true },
  });

  const points = orders
    .filter(o => o.customerLat != null && o.customerLng != null)
    .map(o => ({
      lat: o.customerLat as number,
      lng: o.customerLng as number,
      net: Math.max(0, (o.totalAmount || 0) - (o.deliveryFee || 0) - (o.tipAmount || 0)),
    }));

  return NextResponse.json({ points });
}
