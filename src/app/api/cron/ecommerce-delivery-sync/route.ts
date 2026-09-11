import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deliveryHandrollVendor, fetchDhTracking, mapDhStatus, dhCourier } from "@/lib/ecommerce/deliverySync";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Cron: sincroniza estado + ubicación del repartidor de pedidos delivery activos con
 * deliveryhandroll.cl (solo locales habilitados). Persiste el estado aunque nadie tenga
 * abierta la página de seguimiento (ej: marcar "Entregado"). Protegido con CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const orders = await prisma.onlineOrder.findMany({
    where: { orderType: "DELIVERY", status: { in: ["ACCEPTED", "PREPARING", "READY", "IN_DELIVERY"] }, updatedAt: { gte: since } },
    orderBy: { updatedAt: "desc" },
    take: 150,
    select: {
      id: true, orderNumber: true, toteatOrderId: true, status: true, statusHistory: true, courier: true,
      restaurantId: true, restaurant: { select: { ecommerceConfig: true } },
    },
  });

  // Filtrar a los pedidos de locales con la integración habilitada.
  const eligible = orders
    .map((o) => ({ o, vendor: deliveryHandrollVendor(o.restaurant.ecommerceConfig) }))
    .filter((x): x is { o: (typeof orders)[number]; vendor: string } => !!x.vendor);

  let updated = 0;
  await Promise.allSettled(eligible.map(async ({ o, vendor }) => {
    const track = await fetchDhTracking({ vendorName: vendor, orderNumber: o.orderNumber, toteatOrderId: o.toteatOrderId });
    if (!track) return;
    const newStatus = mapDhStatus(track);
    const courier = dhCourier(track);
    const data: Record<string, unknown> = {};
    if (newStatus && newStatus !== o.status && o.status !== "CANCELLED") {
      const hist = Array.isArray(o.statusHistory) ? (o.statusHistory as { status: string; ts: string }[]) : [];
      const last = hist[hist.length - 1]?.status;
      data.status = newStatus;
      data.statusHistory = last === newStatus ? hist : [...hist, { status: newStatus, ts: new Date().toISOString() }];
    }
    if (courier && (courier.lat != null || courier.name)) {
      const prev = (o.courier && typeof o.courier === "object" ? o.courier : {}) as Record<string, unknown>;
      data.courier = { ...prev, lat: courier.lat, lng: courier.lng, name: courier.name, label: courier.label, updatedAt: new Date().toISOString() };
    }
    if (Object.keys(data).length) {
      const { error } = await prisma.onlineOrder.update({ where: { id: o.id }, data }).then(() => ({ error: null })).catch((e) => ({ error: e }));
      if (!error) updated++;
    }
  }));

  return NextResponse.json({ ok: true, scanned: orders.length, eligible: eligible.length, updated });
}
