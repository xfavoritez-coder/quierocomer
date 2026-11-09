import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertOwnership } from "@/lib/ecommerce/panelAuth";
import { parseStoreConfig } from "@/lib/ecommerce/store-config";

/**
 * GET /api/panel/ecommerce/survey/responses?restaurantId=…
 * Devuelve las respuestas de la encuesta + el promedio por pregunta + tendencia semanal.
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
    take: 500,
    select: { id: true, orderId: true, customerName: true, ratings: true, comment: true, createdAt: true },
  });

  // Datos del pedido asociado
  const orderIds = rows.map((x) => x.orderId).filter((x): x is string => !!x);
  const orders = orderIds.length
    ? await prisma.onlineOrder.findMany({
        where: { id: { in: orderIds } },
        select: { id: true, orderNumber: true, total: true, items: true, customerPhone: true, orderType: true, createdAt: true },
      })
    : [];
  const orderMap = new Map(orders.map((o) => [o.id, o]));

  // Acumular promedios por pregunta
  const acc = new Map<string, { text: string; sum: number; count: number }>();
  // Distribución de estrellas (promedio general por respuesta)
  const starDist: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

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

    // Promedio de esta respuesta para distribución de estrellas
    const validVs = answers.map(a => a.v).filter(v => v >= 1 && v <= 5);
    if (validVs.length > 0) {
      const avg = validVs.reduce((s, v) => s + v, 0) / validVs.length;
      const rounded = Math.round(avg) as 1 | 2 | 3 | 4 | 5;
      if (rounded >= 1 && rounded <= 5) starDist[rounded]++;
    }

    const order = row.orderId ? orderMap.get(row.orderId) : null;
    // Top 3 items del pedido
    let orderItems: string[] = [];
    if (order?.items && Array.isArray(order.items)) {
      orderItems = (order.items as any[])
        .slice(0, 3)
        .map((it: any) => it?.name || it?.title || "")
        .filter(Boolean);
    }

    return {
      id: row.id,
      orderId: row.orderId,
      orderNumber: order?.orderNumber ?? null,
      orderTotal: order?.total ?? null,
      orderType: order?.orderType ?? null,
      orderItems,
      orderCreatedAt: order?.createdAt?.toISOString() ?? null,
      customerName: row.customerName,
      customerPhone: order?.customerPhone ?? null,
      comment: row.comment,
      createdAt: row.createdAt,
      answers,
    };
  });

  // Promedios por pregunta (ordenados según config)
  const order = cfg.survey.questions.map((q) => q.id);
  const seen = new Set<string>();
  const averages: { id: string; text: string; avg: number; count: number }[] = [];
  for (const id of order) {
    const a = acc.get(id);
    if (a) { averages.push({ id, text: cfg.survey.questions.find((q) => q.id === id)?.text || a.text, avg: a.sum / a.count, count: a.count }); seen.add(id); }
    else { const q = cfg.survey.questions.find((qq) => qq.id === id); if (q) { averages.push({ id, text: q.text, avg: 0, count: 0 }); seen.add(id); } }
  }
  for (const [id, a] of acc) if (!seen.has(id)) averages.push({ id, text: a.text, avg: a.sum / a.count, count: a.count });

  // Tendencia semanal: últimas 8 semanas
  const now = new Date();
  const weeklyTrend: { label: string; avg: number; count: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const wStart = new Date(now);
    wStart.setDate(now.getDate() - (i + 1) * 7);
    wStart.setHours(0, 0, 0, 0);
    const wEnd = new Date(now);
    wEnd.setDate(now.getDate() - i * 7);
    wEnd.setHours(23, 59, 59, 999);

    const weekRows = rows.filter(row => row.createdAt >= wStart && row.createdAt <= wEnd);
    let sum = 0, cnt = 0;
    for (const row of weekRows) {
      const ratings = (row.ratings && typeof row.ratings === "object" ? row.ratings : {}) as Record<string, { v?: number }>;
      const vs = Object.values(ratings).map(v => Math.round(Number(v?.v))).filter(v => v >= 1 && v <= 5);
      if (vs.length > 0) { sum += vs.reduce((s, v) => s + v, 0) / vs.length; cnt++; }
    }
    const label = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short" }).format(wStart);
    weeklyTrend.push({ label, avg: cnt > 0 ? Math.round((sum / cnt) * 10) / 10 : 0, count: cnt });
  }

  return NextResponse.json({ averages, responses, total: rows.length, starDist, weeklyTrend });
}
