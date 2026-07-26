import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { flowPost } from "@/lib/billing/flow";
import { FLOW_PLANS } from "@/lib/billing/plans-config";

/**
 * POST /api/billing/subscribe
 * Body: { restaurantId, plan: "SILVER" | "GOLD" | "PREMIUM" }
 *
 * Inicia registro de tarjeta para cobro automático mensual vía Flow suscripciones.
 * Los planes ya existen en Flow (qc_gold_monthly, qc_premium_monthly).
 *
 * 1. /customer/create  → crear cliente en Flow (externalId = restaurantId)
 * 2. /customer/register → URL donde el cliente ingresa su tarjeta
 * 3. subscribe-return   → obtiene customerId, crea suscripción al plan
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
    include: { restaurants: { where: { id: restaurantId }, select: { id: true, name: true }, take: 1 } },
  });
  if (!owner || owner.status !== "ACTIVE") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const restaurant = owner.restaurants[0];
  if (!restaurant) return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });

  const planConfig = FLOW_PLANS[plan];
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.com";

  // 1. Crear cliente en Flow (idempotente — ignorar si ya existe)
  try {
    await flowPost("/customer/create", {
      externalId: restaurantId,
      name: owner.name || owner.email.split("@")[0],
      email: owner.email,
    });
    console.log(`[billing/subscribe] Cliente creado en Flow: externalId=${restaurantId}`);
  } catch (err: any) {
    const alreadyExists = err?.code === 400 || err?.message?.toLowerCase().includes("already") || err?.message?.toLowerCase().includes("existe");
    if (!alreadyExists) {
      console.error("[billing/subscribe] Error creando cliente en Flow:", err?.message);
      return NextResponse.json({ error: `Error al crear cliente en Flow: ${err?.message}` }, { status: 500 });
    }
    console.log(`[billing/subscribe] Cliente ya existe en Flow: externalId=${restaurantId}`);
  }

  // 2. Iniciar registro de tarjeta
  const urlReturn = `${baseUrl}/api/billing/subscribe-return?restaurantId=${restaurantId}&plan=${plan}`;
  try {
    const result = await flowPost<{ url: string; token: string }>("/customer/register", {
      externalId: restaurantId,
      url_return: urlReturn,
    });
    console.log(`[billing/subscribe] Card registration iniciado: token=${result.token} para ${restaurant.name}`);

    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { pendingFlowPlanId: planConfig.planId },
    });

    return NextResponse.json({ url: `${result.url}?token=${result.token}` });
  } catch (err: any) {
    console.error("[billing/subscribe] Error en /customer/register:", err?.message);
    return NextResponse.json({ error: `Error al iniciar registro de tarjeta: ${err?.message}` }, { status: 500 });
  }
}
