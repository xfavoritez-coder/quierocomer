import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createMPCustomer, createMPSubscription } from "@/lib/billing/mercadopago";
import { FLOW_PLANS } from "@/lib/billing/plans-config";

/**
 * POST /api/billing/start
 * Body: { restaurantId, plan: "GOLD" | "PREMIUM" }
 *
 * Crea una suscripcion recurrente en MercadoPago para upgrade de plan.
 */
export async function POST(req: NextRequest) {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let body: { restaurantId?: string; plan?: keyof typeof FLOW_PLANS };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body invalido" }, { status: 400 }); }

  const { restaurantId, plan } = body;
  if (!restaurantId || !plan || !FLOW_PLANS[plan]) {
    return NextResponse.json({ error: "Faltan parametros" }, { status: 400 });
  }

  const owner = await prisma.restaurantOwner.findUnique({
    where: { id: panelId },
    include: { restaurants: { where: { id: restaurantId }, take: 1 } },
  });
  if (!owner || owner.status !== "ACTIVE") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const restaurant = owner.restaurants[0];
  if (!restaurant) return NextResponse.json({ error: "Restaurant no encontrado" }, { status: 404 });

  const planConfig = FLOW_PLANS[plan];
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";

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

    const subscription = await createMPSubscription({
      planKey: plan,
      payerEmail: owner.email,
      externalReference: restaurant.id,
      backUrl: `${baseUrl}/api/billing/return`,
    });

    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { pendingMpPlanId: planConfig.planId, mpSubscriptionId: subscription.id },
    });

    return NextResponse.json({ url: subscription.initPoint });
  } catch (err: any) {
    const msg = err?.message || "Error desconocido";
    console.error("[billing/start]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
