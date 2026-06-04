import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { flowPost } from "@/lib/billing/flow";
import { FLOW_PLANS, grossOf, PLAN_LABELS } from "@/lib/billing/plans-config";

/**
 * POST /api/billing/start
 * Body: { restaurantId, plan: "SILVER" | "GOLD" | "PREMIUM" }
 *
 * Crea un pago único en Flow.cl (Webpay). El cliente paga con su tarjeta
 * sin necesitar cuenta de ninguna plataforma.
 * El ciclo de 30 días se maneja internamente al confirmar el pago.
 */
export async function POST(req: NextRequest) {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let body: { restaurantId?: string; plan?: keyof typeof FLOW_PLANS };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  const { restaurantId, plan } = body;
  if (!restaurantId || !plan || !FLOW_PLANS[plan]) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }

  const owner = await prisma.restaurantOwner.findUnique({
    where: { id: panelId },
    include: { restaurants: { where: { id: restaurantId }, select: { id: true, name: true, customPlanPriceNet: true }, take: 1 } },
  });
  if (!owner || owner.status !== "ACTIVE") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const restaurant = owner.restaurants[0];
  if (!restaurant) return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });

  const planConfig = FLOW_PLANS[plan];
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";
  const amountNet = restaurant.customPlanPriceNet ?? planConfig.amountNet;
  const amountGross = grossOf(amountNet);
  const planLabel = PLAN_LABELS[plan] || plan;
  const commerceOrder = `b_${restaurantId.slice(-8)}_${Date.now().toString(36)}`;

  try {
    console.log(`[billing/start] Creando pago Flow: ${restaurant.name}, plan=${plan}, monto=${amountGross}, order=${commerceOrder}`);
    const payment = await flowPost<{ url: string; token: string; flowOrder: number }>("/payment/create", {
      commerceOrder,
      subject: `${restaurant.name} — Plan ${planLabel} (1 mes)`,
      amount: amountGross,
      email: owner.email,
      urlConfirmation: `${baseUrl}/api/billing/webhook`,
      urlReturn: `${baseUrl}/api/billing/return`,
    });
    console.log(`[billing/start] Flow OK: token=${payment.token}, flowOrder=${payment.flowOrder}, url=${payment.url}`);

    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { pendingFlowPlanId: planConfig.planId, flowRegisterToken: `${payment.token}|${payment.flowOrder}` },
    });

    return NextResponse.json({ url: `${payment.url}?token=${payment.token}` });
  } catch (err: any) {
    const msg = err?.message || "Error desconocido";
    console.error("[billing/start] ERROR:", msg, "code:", err?.code, "status:", err?.status);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
