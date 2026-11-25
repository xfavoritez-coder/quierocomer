import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { teamMemberCanAccess, demoSessionCanAccess } from "@/lib/ecommerce/panelAuth";
import { chileTodayYmd, chileDayRangeUtc } from "@/lib/driver/serialize";
import { getPanelId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertOwnership(req: NextRequest, restaurantId: string): Promise<boolean> {
  const panelId = getPanelId(req);
  if (!panelId) return false;
  if (panelId === "demo") return demoSessionCanAccess(req, restaurantId);
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

  const mode = req.nextUrl.searchParams.get("mode");

  // ── Modo clientes: agrupa por teléfono con datos detallados ──
  if (mode === "clients") {
    const orders = await prisma.posOrder.findMany({
      where: {
        restaurantId,
        posStatus: { not: "canceled" },
        isDelivery: true,
        customerLat: { not: null },
        customerLng: { not: null },
        customerPhone: { not: "" },
        createdAt: { gte: start, lte: end },
      },
      select: {
        customerLat: true, customerLng: true, customerName: true,
        customerPhone: true, customerEmail: true, addressLine: true,
        totalAmount: true, deliveryFee: true, tipAmount: true, createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const map = new Map<string, {
      name: string; phone: string; email: string;
      lat: number; lng: number; address: string;
      orders: number; totalSpent: number;
      firstOrderAt: Date; lastOrderAt: Date;
    }>();

    for (const o of orders) {
      const key = o.customerPhone.replace(/\D/g, "");
      if (!key) continue;
      const net = Math.max(0, (o.totalAmount || 0) - (o.deliveryFee || 0) - (o.tipAmount || 0));
      const existing = map.get(key);
      if (existing) {
        existing.orders++;
        existing.totalSpent += net;
        if (o.createdAt < existing.firstOrderAt) existing.firstOrderAt = o.createdAt;
        // Keep latest lat/lng/name/address (first in desc order)
      } else {
        map.set(key, {
          name: o.customerName || "Cliente",
          phone: o.customerPhone,
          email: o.customerEmail || "",
          lat: o.customerLat as number,
          lng: o.customerLng as number,
          address: o.addressLine || "",
          orders: 1,
          totalSpent: net,
          firstOrderAt: o.createdAt,
          lastOrderAt: o.createdAt,
        });
      }
    }

    const clients = [...map.values()]
      .map(c => ({
        ...c,
        avgTicket: c.orders > 0 ? Math.round(c.totalSpent / c.orders) : 0,
        firstOrderAt: c.firstOrderAt.toISOString(),
        lastOrderAt: c.lastOrderAt.toISOString(),
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent);

    return NextResponse.json({ clients });
  }

  // ── Modo default: puntos para heatmap ──
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
