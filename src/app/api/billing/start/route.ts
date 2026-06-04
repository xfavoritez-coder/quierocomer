import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createMPCustomer, createMPSubscription } from "@/lib/billing/mercadopago";
import { FLOW_PLANS, grossOf } from "@/lib/billing/plans-config";

/**
 * POST /api/billing/start
 * Body: { restaurantId, plan: "SILVER" | "GOLD" | "PREMIUM" }
 *
 * Crea una suscripción recurrente mensual en MercadoPago.
 * MP cobra automáticamente cada mes.
 */
export async function POST(req: NextRequest) {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let body: { restaurantId?: string; plan?: keyof typeof FLOW_PLANS; payerEmail?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  const { restaurantId, plan, payerEmail: bodyPayerEmail } = body;
  if (!restaurantId || !plan || !FLOW_PLANS[plan]) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }

  const owner = await prisma.restaurantOwner.findUnique({
    where: { id: panelId },
    include: { restaurants: { where: { id: restaurantId }, select: { id: true, name: true, mpCustomerId: true, customPlanPriceNet: true, mpPayerEmail: true }, take: 1 } },
  });
  if (!owner || owner.status !== "ACTIVE") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const restaurant = owner.restaurants[0];
  if (!restaurant) return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });

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

    // Si el usuario envió un email de MP, guardarlo para futuras suscripciones
    const effectivePayerEmail = bodyPayerEmail?.trim() || restaurant.mpPayerEmail || owner.email;
    if (bodyPayerEmail?.trim() && bodyPayerEmail.trim() !== restaurant.mpPayerEmail) {
      await prisma.restaurant.update({ where: { id: restaurant.id }, data: { mpPayerEmail: bodyPayerEmail.trim().toLowerCase() } }).catch(() => {});
    }

    const subscription = await createMPSubscription({
      planKey: plan,
      payerEmail: effectivePayerEmail,
      externalReference: restaurantId,
      backUrl: `${baseUrl}/api/billing/return?plan=${plan}`,
      amountNetOverride: restaurant.customPlanPriceNet ?? undefined,
    });

    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { pendingMpPlanId: planConfig.planId },
    });

    return NextResponse.json({ url: subscription.initPoint });
  } catch (err: any) {
    const msg = err?.message || "Error desconocido";
    console.error("[billing/start]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
