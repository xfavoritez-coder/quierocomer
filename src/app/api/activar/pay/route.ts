import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createMPCustomer,
  createMPPreference,
  createMPSubscription,
} from "@/lib/billing/mercadopago";
import { FLOW_PLANS, activationPromoAmount, grossOf } from "@/lib/billing/plans-config";

/**
 * POST /api/activar/pay
 * Body: { restaurantId, plan: "GOLD" | "PREMIUM", skipPromo?: boolean }
 *
 * Dos flujos:
 * - Con promo: pago unico del primer mes (Preference) → al completarse,
 *   el return handler crea la suscripcion recurrente desde el dia 30.
 * - Sin promo: suscripcion directa (PreApproval) a precio regular.
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

    const promoNet = skipPromo ? null : activationPromoAmount(planKey);

    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { pendingMpPlanId: planConfig.planId },
    });

    if (promoNet !== null) {
      // ── Promo: pago unico del primer mes ──
      const promoGross = grossOf(promoNet);
      const returnUrl = `${baseUrl}/api/activar/pay/return`;

      const preference = await createMPPreference({
        title: `${planConfig.name} - Primer mes (promo)`,
        amountGross: promoGross,
        externalReference: restaurant.id,
        payerEmail: ownerEmail,
        notificationUrl: `${baseUrl}/api/billing/webhook`,
        backUrls: { success: returnUrl, failure: returnUrl, pending: returnUrl },
      });

      return NextResponse.json({ url: preference.initPoint || preference.sandboxInitPoint });
    } else {
      // ── Sin promo: suscripcion recurrente directa ──
      const subscription = await createMPSubscription({
        planKey,
        payerEmail: ownerEmail,
        externalReference: restaurant.id,
        backUrl: `${baseUrl}/api/activar/pay/return`,
      });

      return NextResponse.json({ url: subscription.initPoint });
    }
  } catch (err: any) {
    const msg = err?.message || "Error desconocido";
    console.error("[activar/pay]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
