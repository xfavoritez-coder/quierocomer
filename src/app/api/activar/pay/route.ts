import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createMPPreference } from "@/lib/billing/mercadopago";
import { FLOW_PLANS, PLAN_LABELS, activationPromoAmount, grossOf } from "@/lib/billing/plans-config";

/**
 * POST /api/activar/pay
 * Body: { restaurantId, plan: "SILVER" | "GOLD" | "PREMIUM", skipPromo?: boolean }
 *
 * Crea un pago único (Checkout Pro) en MercadoPago para activación desde demo.
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

  const planKey = plan as "SILVER" | "GOLD" | "PREMIUM";
  const planConfig = FLOW_PLANS[planKey];
  const planLabel = PLAN_LABELS[planKey] || planKey;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://${req.headers.get("host")}`;

  // Determinar monto: promo o regular
  const promoNet = skipPromo ? null : activationPromoAmount(planKey);
  const amountNet = promoNet ?? planConfig.amountNet;
  const amountGross = grossOf(amountNet);

  try {
    const preference = await createMPPreference({
      title: `${restaurant.name} — Plan ${planLabel}${promoNet !== null ? " (primer mes promo)" : ""} (1 mes)`,
      amountGross,
      externalReference: restaurantId,
      backUrls: {
        success: `${baseUrl}/api/activar/pay/return?plan=${planKey}&status=approved`,
        failure: `${baseUrl}/activar/${restaurant.slug}?status=failure`,
        pending: `${baseUrl}/activar/${restaurant.slug}?status=pending`,
      },
    });

    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { pendingMpPlanId: planConfig.planId },
    });

    return NextResponse.json({ url: preference.initPoint });
  } catch (err: any) {
    const msg = err?.message || "Error desconocido";
    console.error("[activar/pay]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
