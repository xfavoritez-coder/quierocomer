import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertOwnership } from "@/lib/ecommerce/panelAuth";
import { parseStoreConfig } from "@/lib/ecommerce/store-config";

/**
 * GET /api/panel/ecommerce/survey/responses?restaurantId=…
 * Devuelve las respuestas de la encuesta + el promedio por pregunta.
 */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ecommerceStoreConfig: true, cartaAccentColor: true } });
  const cfg = parseStoreConfig(r?.ecommerceStoreConfig, { accent: r?.cartaAccentColor });

  const rows = await prisma.ecommerceSurveyResponse.findMany({
    where: { restaurantId },
    orderBy: { createdAt: "desc" },
    take: 300,
    select: { id: true, orderId: true, customerName: true, ratings: true, comment: true, createdAt: true },
  });

  // Números de pedido para mostrar "· #107"
  const orderIds = rows.map((x) => x.orderId).filter((x): x is string => !!x);
  const orders = orderIds.length
    ? await prisma.onlineOrder.findMany({ where: { id: { in: orderIds } }, select: { id: true, orderNumber: true } })
    : [];
  const numberOf = new Map(orders.map((o) => [o.id, o.orderNumber]));

  // Acumular promedios por pregunta (por questionId)
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
      orderId: row.orderId,
      orderNumber: row.orderId ? numberOf.get(row.orderId) ?? null : null,
      customerName: row.customerName,
      comment: row.comment,
      createdAt: row.createdAt,
      answers,
    };
  });

  // Promedios ordenados según la config actual (preguntas activas primero), luego extras.
  const order = cfg.survey.questions.map((q) => q.id);
  const seen = new Set<string>();
  const averages: { id: string; text: string; avg: number; count: number }[] = [];
  for (const id of order) {
    const a = acc.get(id);
    if (a) { averages.push({ id, text: cfg.survey.questions.find((q) => q.id === id)?.text || a.text, avg: a.sum / a.count, count: a.count }); seen.add(id); }
    else { const q = cfg.survey.questions.find((qq) => qq.id === id); if (q) { averages.push({ id, text: q.text, avg: 0, count: 0 }); seen.add(id); } }
  }
  for (const [id, a] of acc) if (!seen.has(id)) averages.push({ id, text: a.text, avg: a.sum / a.count, count: a.count });

  return NextResponse.json({ averages, responses, total: rows.length });
}
