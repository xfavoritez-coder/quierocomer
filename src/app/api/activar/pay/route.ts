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
 * Body: { restaurantId, plan: "GOLD" | "PREMIUM" }
 *
 * Inicia el pago de activacion via MercadoPago para un restaurant demo.
 *
 * - Si hay promo (ej: PREMIUM primer mes a $4.900+IVA), crea una Preference
 *   de pago unico. Al completarse, el return handler crea la suscripcion.
 * - Si no hay promo (ej: GOLD), crea directamente una suscripcion (PreApproval)
 *   que cobra el precio regular desde el primer mes.
 *
 * No requiere autenticacion — solo funciona para restaurants con isDemo: true.
 */
export async function POST(req: NextRequest) {
  let body: { restaurantId?: string; plan?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  const { restaurantId, plan } = body;
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
    // Crear o encontrar customer en MercadoPago (opcional, no bloquea el flujo)
    let mpCustomerId = restaurant.mpCustomerId;
    if (!mpCustomerId) {
      try {
        const customer = await createMPCustomer(
          ownerEmail,
          restaurant.owner?.name || restaurant.name,
        );
        mpCustomerId = customer.id;
        await prisma.restaurant.update({
          where: { id: restaurant.id },
          data: { mpCustomerId },
        });
      } catch (err: any) {
        console.warn("[activar/pay] createMPCustomer falló (no bloquea):", err?.message);
      }
    }

    const promoNet = activationPromoAmount(planKey);

    if (promoNet !== null) {
      // ── Promo: pago unico del primer mes a precio reducido ──
      const promoGross = grossOf(promoNet);

      const returnUrl = `${baseUrl}/api/activar/pay/return`;
      const preference = await createMPPreference({
        title: `${planConfig.name} - Primer mes (promo)`,
        amountGross: promoGross,
        externalReference: restaurant.id,
        payerEmail: ownerEmail,
        notificationUrl: `${baseUrl}/api/activar/pay/webhook`,
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

      // En sandbox usar sandboxInitPoint, en producción initPoint
      const url = preference.sandboxInitPoint || preference.initPoint;
      return NextResponse.json({ url });
    } else {
      // ── Sin promo: crear suscripcion directa a precio regular ──
      const subscription = await createMPSubscription({
        planKey,
        payerEmail: ownerEmail,
        externalReference: restaurant.id,
        backUrl: `${baseUrl}/api/activar/pay/return`,
      });

      await prisma.restaurant.update({
        where: { id: restaurant.id },
        data: { pendingMpPlanId: planConfig.planId },
      });

      // El init_point de la suscripcion lleva al usuario a MP para pagar
      return NextResponse.json({ url: subscription.initPoint });
    }
  } catch (err: any) {
    const msg = err?.message || "Error desconocido";
    console.error("[activar/pay]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
