import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/ecommerce-surveys?restaurantId=X&limit=200
 * Devuelve respuestas de encuestas de satisfacción.
 * Si restaurantId está vacío, devuelve de todos los locales.
 */
export async function GET(req: NextRequest) {
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || null;
  const limit = Math.min(500, parseInt(req.nextUrl.searchParams.get("limit") || "200", 10));

  const rows = await prisma.ecommerceSurveyResponse.findMany({
    where: restaurantId ? { restaurantId } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      restaurantId: true,
      orderId: true,
      customerName: true,
      ratings: true,
      comment: true,
      createdAt: true,
    },
  });

  // Nombres de restaurantes
  const rIds = [...new Set(rows.map((r) => r.restaurantId))];
  const restaurants = await prisma.restaurant.findMany({
    where: { id: { in: rIds } },
    select: { id: true, name: true },
  });
  const rName = new Map(restaurants.map((r) => [r.id, r.name]));

  // Números de pedido
  const orderIds = rows.map((x) => x.orderId).filter((x): x is string => !!x);
  const orders = orderIds.length
    ? await prisma.onlineOrder.findMany({ where: { id: { in: orderIds } }, select: { id: true, orderNumber: true } })
    : [];
  const numberOf = new Map(orders.map((o) => [o.id, o.orderNumber]));

  // Acumular promedios por pregunta (global o por restaurante seleccionado)
  const acc = new Map<string, { text: string; sum: number; count: number }>();

  const responses = rows.map((row) => {
    const ratings = (row.ratings && typeof row.ratings === "object" ? row.ratings : {}) as Record<string, { t?: string; v?: number }>;
    const answers = Object.entries(ratings).map(([id, val]) => {
      const v = Math.round(Number(val?.v));
      const text = typeof val?.t === "string" ? val.t : id;
      if (Number.isFinite(v) && v >= 1 && v <= 5) {
        const a = acc.get(id) || { text, sum: 0, count: 0 };
        a.sum += v; a.count += 1; a.text = text; acc.set(id, a);
      }
      return { id, text, v };
    });
    return {
      id: row.id,
      restaurantId: row.restaurantId,
      restaurantName: rName.get(row.restaurantId) || row.restaurantId,
      orderId: row.orderId,
      orderNumber: row.orderId ? numberOf.get(row.orderId) ?? null : null,
      customerName: row.customerName,
      comment: row.comment,
      createdAt: row.createdAt,
      answers,
    };
  });

  const averages = [...acc.entries()].map(([id, a]) => ({
    id, text: a.text, avg: a.sum / a.count, count: a.count,
  })).sort((a, b) => b.count - a.count);

  // Lista de restaurantes con encuestas para el selector
  const restaurantList = [...rName.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "es"));

  return NextResponse.json({ averages, responses, total: rows.length, restaurantList });
}
