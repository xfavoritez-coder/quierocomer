import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createMPCustomer,
  createMPPreference,
} from "@/lib/billing/mercadopago";
import { FLOW_PLANS, activationPromoAmount, grossOf } from "@/lib/billing/plans-config";

/**
 * POST /api/activar/pay
 * Body: { restaurantId, plan: "GOLD" | "PREMIUM", skipPromo?: boolean }
 *
 * Inicia el pago via MercadoPago Checkout Pro (pago unico).
 * - Si hay promo y no se salta: cobra precio promo del primer mes.
 * - Si no hay promo o skipPromo: cobra precio regular del primer mes.
 *
 * El plan se activa por 30 dias. Antes de vencer se envia recordatorio
 * con link de renovacion.
 */
export async function POST(req: NextRequest) {
  let body: { restaurantId?: string; plan?: string; skipPromo?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  const { restaurantId, plan, skipPromo } = body;
  if (!restaurantId || !plan || !(plan === "GOLD" || plan === "PREMIUM")) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: { owner: { select: { email: true, name: true } } },
  });

  if (!restaurant || !restaurant.isDemo) {
    return NextResponse.json({ error: "Restaurant no encontrado o ya activado" }, { status: 404 });
  }

  const ownerEmail = restaurant.owner?.email;
  if (!ownerEmail) {
    return NextResponse.json({ error: "No hay email del dueño. Contacta soporte." }, { status: 400 });
  }

  const planKey = plan as "GOLD" | "PREMIUM";
  const planConfig = FLOW_PLANS[planKey];
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://${req.headers.get("host")}`;

  try {
    // Crear o encontrar customer en MercadoPago (opcional, no bloquea)
    if (!restaurant.mpCustomerId) {
      try {
        const customer = await createMPCustomer(ownerEmail, restaurant.owner?.name || restaurant.name);
        await prisma.restaurant.update({ where: { id: restaurant.id }, data: { mpCustomerId: customer.id } });
      } catch (err: any) {
        console.warn("[activar/pay] createMPCustomer falló (no bloquea):", err?.message);
      }
    }

    // Determinar monto: promo o regular
    const promoNet = skipPromo ? null : activationPromoAmount(planKey);
    const chargeNet = promoNet ?? planConfig.amountNet;
    const chargeGross = grossOf(chargeNet);
    const isPromo = promoNet !== null;

    const title = isPromo
      ? `${planConfig.name} - Primer mes (promo)`
      : `${planConfig.name} - Mensualidad`;

    const returnUrl = `${baseUrl}/api/activar/pay/return`;
    const preference = await createMPPreference({
      title,
      amountGross: chargeGross,
      externalReference: restaurant.id,
      payerEmail: ownerEmail,
      backUrls: {
        success: returnUrl,
        failure: returnUrl,
        pending: returnUrl,
      },
    });

    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { pendingMpPlanId: planConfig.planId },
    });

    const url = preference.initPoint || preference.sandboxInitPoint;
    return NextResponse.json({ url });
  } catch (err: any) {
    const msg = err?.message || "Error desconocido";
    console.error("[activar/pay]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
