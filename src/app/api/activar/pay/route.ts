import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createMPCustomer, createMPPreference } from "@/lib/billing/mercadopago";
import { FLOW_PLANS, activationPromoAmount, grossOf } from "@/lib/billing/plans-config";

/**
 * POST /api/activar/pay
 * Body: { restaurantId, plan: "SILVER" | "GOLD" | "PREMIUM", skipPromo?: boolean }
 *
 * Crea una preferencia de pago único en MercadoPago para activación desde demo.
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
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://${req.headers.get("host")}`;

  // Determinar monto (promo o regular)
  const promoNet = skipPromo ? null : activationPromoAmount(planKey);
  const amountGross = promoNet !== null ? grossOf(promoNet) : grossOf(planConfig.amountNet);

  try {
    // Crear customer (opcional, no bloquea)
    if (!restaurant.mpCustomerId) {
      try {
        const customer = await createMPCustomer(ownerEmail, restaurant.owner?.name || restaurant.name);
        await prisma.restaurant.update({ where: { id: restaurant.id }, data: { mpCustomerId: customer.id } });
      } catch (err: any) {
        console.warn("[activar/pay] createMPCustomer falló (no bloquea):", err?.message);
      }
    }

    const preference = await createMPPreference({
      title: `${planConfig.name} — 1 mes`,
      amountGross,
      externalReference: restaurantId,
      payerEmail: ownerEmail,
      notificationUrl: `${baseUrl}/api/billing/webhook`,
      backUrls: {
        success: `${baseUrl}/api/activar/pay/return?plan=${planKey}`,
        failure: `${baseUrl}/activar/${restaurant.slug}?pago=error`,
        pending: `${baseUrl}/activar/${restaurant.slug}?pago=pendiente`,
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
