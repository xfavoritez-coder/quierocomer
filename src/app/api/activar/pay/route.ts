import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createMPCustomer, createMPSubscription } from "@/lib/billing/mercadopago";
import { FLOW_PLANS, activationPromoAmount, grossOf } from "@/lib/billing/plans-config";

/**
 * POST /api/activar/pay
 * Body: { restaurantId, plan: "GOLD" | "PREMIUM", skipPromo?: boolean }
 *
 * Crea una suscripcion en MercadoPago. El usuario registra su tarjeta una vez
 * y MP cobra automaticamente cada mes.
 *
 * - Con promo: primer mes a precio reducido, despues precio regular.
 * - Sin promo: precio regular desde el inicio.
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
    // Crear customer (opcional, no bloquea)
    if (!restaurant.mpCustomerId) {
      try {
        const customer = await createMPCustomer(ownerEmail, restaurant.owner?.name || restaurant.name);
        await prisma.restaurant.update({ where: { id: restaurant.id }, data: { mpCustomerId: customer.id } });
      } catch (err: any) {
        console.warn("[activar/pay] createMPCustomer falló (no bloquea):", err?.message);
      }
    }

    // Determinar si hay promo para el primer mes
    const promoNet = skipPromo ? null : activationPromoAmount(planKey);
    const firstAmountGross = promoNet !== null ? grossOf(promoNet) : undefined;

    const subscription = await createMPSubscription({
      planKey,
      payerEmail: ownerEmail,
      externalReference: restaurant.id,
      backUrl: `${baseUrl}/api/activar/pay/return`,
      firstAmountGross,
    });

    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { pendingMpPlanId: planConfig.planId },
    });

    return NextResponse.json({ url: subscription.initPoint });
  } catch (err: any) {
    const msg = err?.message || "Error desconocido";
    console.error("[activar/pay]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
