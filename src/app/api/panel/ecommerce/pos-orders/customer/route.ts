import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { teamMemberCanAccess } from "@/lib/ecommerce/panelAuth";
import { isSuperAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertOwnership(req: NextRequest, restaurantId: string): Promise<boolean> {
  if (isSuperAdmin(req)) return true;
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return false;
  if (panelId === "demo") return true;
  if (panelId.startsWith("tm_")) return teamMemberCanAccess(panelId.slice(3), restaurantId);
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  return r?.ownerId === panelId;
}

/** GET /api/panel/ecommerce/pos-orders/customer?restaurantId=X&phone=Y[&countOnly=1]
 *  Con countOnly=1 devuelve solo { count } (rápido).
 *  Sin countOnly devuelve { count, orders } con el historial completo. */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  const phone = req.nextUrl.searchParams.get("phone") || "";
  const countOnly = req.nextUrl.searchParams.get("countOnly") === "1";
  if (!restaurantId || !phone) return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const where = { restaurantId, customerPhone: phone, posStatus: { not: "canceled" } } as const;

  if (countOnly) {
    const count = await prisma.posOrder.count({ where });
    return NextResponse.json({ count });
  }

  const orders = await prisma.posOrder.findMany({
    where,
    select: {
      id: true,
      orderReference: true,
      customerName: true,
      customerPhone: true,
      addressLine: true,
      saleType: true,
      isDelivery: true,
      opsStage: true,
      opsReadyForDeliveryAt: true,
      opsDispatchedAt: true,
      opsDeliveredAt: true,
      totalAmount: true,
      paidAmount: true,
      tipAmount: true,
      changeAmount: true,
      deliveryFee: true,
      items: true,
      createdAt: true,
      posStatus: true,
      vendorName: true,
      tableLabel: true,
      rawPayload: true,
    },
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  return NextResponse.json({ count: orders.length, orders });
}
