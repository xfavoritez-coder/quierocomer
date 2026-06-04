import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createMPPreference } from "@/lib/billing/mercadopago";
import { FLOW_PLANS, grossOf, PLAN_LABELS } from "@/lib/billing/plans-config";

/**
 * POST /api/billing/start
 * Body: { restaurantId, plan: "SILVER" | "GOLD" | "PREMIUM" }
 *
 * Crea un pago único (Checkout Pro) en MercadoPago.
 * Cualquier persona puede pagar con cualquier cuenta de MP.
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

  try {
    const preference = await createMPPreference({
      title: `${restaurant.name} — Plan ${planLabel} (1 mes)`,
      amountGross,
      externalReference: restaurantId,
      backUrls: {
        success: `${baseUrl}/api/billing/return?plan=${plan}&status=approved`,
        failure: `${baseUrl}/panel/suscripcion?status=failure`,
        pending: `${baseUrl}/panel/suscripcion?status=pending`,
      },
    });

    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { pendingMpPlanId: planConfig.planId },
    });

    return NextResponse.json({ url: preference.initPoint });
  } catch (err: any) {
    const msg = err?.message || "Error desconocido";
    console.error("[billing/start]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
