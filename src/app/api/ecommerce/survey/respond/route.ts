import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseStoreConfig } from "@/lib/ecommerce/store-config";

export const runtime = "nodejs";

/**
 * POST /api/ecommerce/survey/respond
 * Guarda la respuesta de una encuesta de satisfacción (una por pedido).
 * body: { orderId, answers: { [questionId]: 1..5 }, comment? }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const orderId = typeof body?.orderId === "string" ? body.orderId : "";
    const answers = (body?.answers && typeof body.answers === "object" ? body.answers : {}) as Record<string, unknown>;
    const comment = typeof body?.comment === "string" ? body.comment.trim().slice(0, 1000) : "";
    if (!orderId) return NextResponse.json({ error: "Falta el pedido" }, { status: 400 });

    const order = await prisma.onlineOrder.findUnique({
      where: { id: orderId },
      select: { id: true, customerName: true, restaurantId: true, restaurant: { select: { ecommerceStoreConfig: true, cartaAccentColor: true } } },
    });
    if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });

    const existing = await prisma.ecommerceSurveyResponse.findUnique({ where: { orderId }, select: { id: true } });
    if (existing) return NextResponse.json({ error: "Esta encuesta ya fue respondida", already: true }, { status: 409 });

    const cfg = parseStoreConfig(order.restaurant.ecommerceStoreConfig, { accent: order.restaurant.cartaAccentColor });
    const active = cfg.survey.questions.filter((q) => q.active);
    if (active.length === 0) return NextResponse.json({ error: "La encuesta no tiene preguntas activas" }, { status: 400 });

    // Snapshot { questionId: { t: texto, v: valor } } — conserva el texto al momento de responder.
    const ratings: Record<string, { t: string; v: number }> = {};
    for (const q of active) {
      const v = Math.round(Number(answers[q.id]));
      if (!Number.isFinite(v) || v < 1 || v > 5) return NextResponse.json({ error: "Responde todas las preguntas (1 a 5)" }, { status: 400 });
      ratings[q.id] = { t: q.text, v };
    }

    await prisma.ecommerceSurveyResponse.create({
      data: { restaurantId: order.restaurantId, orderId: order.id, customerName: order.customerName, ratings, comment: comment || null },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("survey respond error:", e);
    return NextResponse.json({ error: "Error al guardar la respuesta" }, { status: 500 });
  }
}
