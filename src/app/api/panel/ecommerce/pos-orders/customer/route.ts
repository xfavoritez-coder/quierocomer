import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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
  const email = req.nextUrl.searchParams.get("email") || "";
  const rawBranchIds = req.nextUrl.searchParams.get("branchIds") || "";
  const extraIds = rawBranchIds ? rawBranchIds.split(",").map(s => s.trim()).filter(Boolean) : [];
  const allIds = Array.from(new Set([restaurantId, ...extraIds]));
  const countOnly = req.nextUrl.searchParams.get("countOnly") === "1";
  if (!restaurantId || (!phone && !email)) return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const orClauses: { customerPhone?: string; customerEmail?: string }[] = [];
  if (phone) orClauses.push({ customerPhone: phone });
  if (email) orClauses.push({ customerEmail: email });
  const where = { restaurantId: { in: allIds }, posStatus: { not: "canceled" as const }, ...(orClauses.length > 0 ? { OR: orClauses } : {}) };

  if (countOnly) {
    const count = await prisma.posOrder.count({ where });
    return NextResponse.json({ count });
  }

  // Modo LITE: búsqueda de cliente por teléfono para el tomador de pedidos.
  // Devuelve el nombre y las direcciones de delivery conocidas. El teléfono se
  // normaliza a los últimos 9 dígitos (los formatos guardados varían: "+56 9 …",
  // "569…", "9…"), así que el match se hace en SQL quitando lo no numérico.
  if (req.nextUrl.searchParams.get("lite") === "1") {
    const digits9 = phone.replace(/\D/g, "").slice(-9);
    if (digits9.length < 8) return NextResponse.json({ found: false, name: "", addresses: [] });
    const rows = await prisma.$queryRaw<{ customerName: string | null; addressLine: string | null; isDelivery: boolean; saleType: string | null }[]>`
      SELECT "customerName", "addressLine", "isDelivery", "saleType"
      FROM "PosOrder"
      WHERE "restaurantId" IN (${Prisma.join(allIds)})
        AND "posStatus" <> 'canceled'
        AND right(regexp_replace(coalesce("customerPhone", ''), '[^0-9]', '', 'g'), 9) = ${digits9}
      ORDER BY "createdAt" DESC
      LIMIT 40`;
    if (!rows.length) return NextResponse.json({ found: false, name: "", addresses: [] });
    const name = rows.find((r) => (r.customerName || "").trim())?.customerName?.trim() || "";
    const seen = new Set<string>();
    const addresses: string[] = [];
    for (const r of rows) {
      const a = (r.addressLine || "").trim();
      if (!(r.isDelivery || r.saleType === "delivery") || !a) continue;
      const key = a.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      addresses.push(a);
      if (addresses.length >= 8) break;
    }
    return NextResponse.json({ found: true, name, addresses });
  }

  type OrderRow = {
    id: string; orderReference: string | null; customerName: string; customerPhone: string;
    addressLine: string; saleType: string; isDelivery: boolean; opsStage: string;
    opsReadyForDeliveryAt: string | null; opsDispatchedAt: string | null; opsDeliveredAt: string | null;
    totalAmount: number; paidAmount: number; tipAmount: number; changeAmount: number;
    deliveryFee: number; items: unknown; createdAt: Date; posStatus: string;
    vendorName: string | null; tableLabel: string | null; rawPayload: unknown;
    surveySentAt: Date | null; surveyEmailOpenedAt: Date | null;
  };
  // surveySentAt and surveyEmailOpenedAt live on OnlineOrder, not PosOrder — always null here
  const baseSelect = {
    id: true, orderReference: true, customerName: true, customerPhone: true,
    addressLine: true, saleType: true, isDelivery: true, opsStage: true,
    opsReadyForDeliveryAt: true, opsDispatchedAt: true, opsDeliveredAt: true,
    totalAmount: true, paidAmount: true, tipAmount: true, changeAmount: true,
    deliveryFee: true, items: true, createdAt: true, posStatus: true,
    vendorName: true, tableLabel: true, rawPayload: true,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let orders: OrderRow[];
  orders = await prisma.posOrder.findMany({
    where, orderBy: { createdAt: "desc" }, take: 60,
    select: baseSelect,
  }) as unknown as OrderRow[];
  orders = orders.map(o => ({ ...o, surveySentAt: null, surveyEmailOpenedAt: null }));

  // Check which orders have a survey response
  const orderIds = orders.map(o => o.id);
  let raw: { orderId: string | null; createdAt: Date; ratings: unknown; comment: string | null }[] = [];
  try {
    raw = orderIds.length > 0
      ? await prisma.ecommerceSurveyResponse.findMany({
          where: { orderId: { in: orderIds } },
          select: { orderId: true, createdAt: true, ratings: true, comment: true },
        })
      : [];
  } catch {
    // survey response table may not exist yet — return orders without survey data
  }
  const responseMap = new Map(raw.filter(r => r.orderId != null).map(r => [r.orderId as string, { answeredAt: r.createdAt, ratings: r.ratings, comment: r.comment }]));

  const enriched = orders.map(o => {
    const sr = responseMap.get(o.id);
    return { ...o, surveyAnsweredAt: sr?.answeredAt ?? null, surveyRatings: sr?.ratings ?? null, surveyComment: sr?.comment ?? null };
  });

  return NextResponse.json({ count: enriched.length, orders: enriched });
}
