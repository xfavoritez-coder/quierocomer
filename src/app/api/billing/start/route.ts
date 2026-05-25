import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createMPCustomer, createMPPreference } from "@/lib/billing/mercadopago";
import { FLOW_PLANS, grossOf } from "@/lib/billing/plans-config";

/**
 * POST /api/billing/start
 * Body: { restaurantId, plan: "SILVER" | "GOLD" | "PREMIUM" }
 *
 * Crea una preferencia de pago único mensual en MercadoPago.
 * El usuario paga 1 mes cada vez (no suscripción recurrente).
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
    include: { restaurants: { where: { id: restaurantId }, take: 1 } },
  });
  if (!owner || owner.status !== "ACTIVE") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const restaurant = owner.restaurants[0];
  if (!restaurant) return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });

  const planConfig = FLOW_PLANS[plan];
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";
  const amountGross = grossOf(planConfig.amountNet);

  try {
    // Crear customer si no existe (no bloquea)
    if (!restaurant.mpCustomerId) {
      try {
        const customer = await createMPCustomer(owner.email, restaurant.name);
        await prisma.restaurant.update({ where: { id: restaurant.id }, data: { mpCustomerId: customer.id } });
      } catch (err: any) {
        console.warn("[billing/start] createMPCustomer falló (no bloquea):", err?.message);
      }
    }

    const preference = await createMPPreference({
      title: `${planConfig.name} — 1 mes`,
      amountGross,
      externalReference: restaurantId,
      payerEmail: owner.email,
      notificationUrl: `${baseUrl}/api/billing/webhook`,
      backUrls: {
        success: `${baseUrl}/api/billing/return?plan=${plan}`,
        failure: `${baseUrl}/panel?billing=error&reason=payment_failed`,
        pending: `${baseUrl}/panel?billing=pending`,
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
