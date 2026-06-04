import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { flowPost } from "@/lib/billing/flow";
import { FLOW_PLANS, PLAN_LABELS, activationPromoAmount, grossOf } from "@/lib/billing/plans-config";

/**
 * POST /api/activar/pay
 * Body: { restaurantId, plan: "SILVER" | "GOLD" | "PREMIUM", skipPromo?: boolean }
 *
 * Crea un pago único en Flow.cl (Webpay) para activación desde demo.
 * Con promo: primer mes a precio reducido.
 */
export async function POST(req: NextRequest) {
  let body: { restaurantId?: string; plan?: string; skipPromo?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  const { restaurantId, plan, skipPromo } = body;
  if (!restaurantId || !plan || !(plan === "SILVER" || plan === "GOLD" || plan === "PREMIUM")) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: { owner: { select: { email: true, name: true } } },
  });

  if (!restaurant || !restaurant.isDemo) {
    return NextResponse.json({ error: "Restaurante no encontrado o ya activado" }, { status: 404 });
  }

  const ownerEmail = restaurant.owner?.email;
  if (!ownerEmail) {
    return NextResponse.json({ error: "No hay email del dueño. Contacta soporte." }, { status: 400 });
  }

  const planKey = plan as "SILVER" | "GOLD" | "PREMIUM";
  const planConfig = FLOW_PLANS[planKey];
  const planLabel = PLAN_LABELS[planKey] || planKey;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://${req.headers.get("host")}`;

  // Determinar monto: promo o regular
  const promoNet = skipPromo ? null : activationPromoAmount(planKey);
  const amountNet = promoNet ?? planConfig.amountNet;
  const amountGross = grossOf(amountNet);
  const commerceOrder = `a_${restaurantId.slice(-8)}_${Date.now().toString(36)}`;

  try {
    const payment = await flowPost<{ url: string; token: string; flowOrder: number }>("/payment/create", {
      commerceOrder,
      subject: `${restaurant.name} — Plan ${planLabel}${promoNet !== null ? " (primer mes promo)" : ""} (1 mes)`,
      amount: amountGross,
      email: ownerEmail,
      urlConfirmation: `${baseUrl}/api/billing/webhook`,
      urlReturn: `${baseUrl}/api/activar/pay/return?plan=${planKey}`,
    });

    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { pendingFlowPlanId: planConfig.planId, flowRegisterToken: payment.token },
    });

    return NextResponse.json({ url: `${payment.url}?token=${payment.token}` });
  } catch (err: any) {
    const msg = err?.message || "Error desconocido";
    console.error("[activar/pay]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
