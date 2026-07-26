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

  // 1. Obtener customerId de Flow (guardado en DB, o buscar en Flow, o crear nuevo)
  const currentRestaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { flowCustomerId: true },
  });

  let flowCustomerId = currentRestaurant?.flowCustomerId || null;

  if (!flowCustomerId) {
    // Buscar cliente existente en Flow por externalId antes de intentar crear
    try {
      const list = await flowPost<{ data: Array<{ customerId: string }> }>("/customer/getList", {
        filter: restaurantId,
        start: 0,
        limit: 1,
      });
      flowCustomerId = list?.data?.[0]?.customerId || null;
      if (flowCustomerId) {
        await prisma.restaurant.update({ where: { id: restaurantId }, data: { flowCustomerId } });
        console.log(`[billing/subscribe] Cliente encontrado en Flow: customerId=${flowCustomerId}`);
      }
    } catch (listErr: any) {
      console.log(`[billing/subscribe] getList sin resultado: ${listErr?.message}`);
    }
  }

  if (!flowCustomerId) {
    // Crear cliente nuevo en Flow
    try {
      const created = await flowPost<{ customerId: string }>("/customer/create", {
        externalId: restaurantId,
        name: owner.name || owner.email.split("@")[0],
        email: owner.email,
      });
      flowCustomerId = created.customerId;
      await prisma.restaurant.update({ where: { id: restaurantId }, data: { flowCustomerId } });
      console.log(`[billing/subscribe] Cliente creado en Flow: customerId=${flowCustomerId}`);
    } catch (err: any) {
      // Flow devuelve 401 cuando el externalId ya existe — extraer customerId del mensaje si viene
      const msg = err?.message || "";
      const match = msg.match(/externalId[:\s]+([a-z0-9]+)/i);
      console.error(`[billing/subscribe] Error en /customer/create: ${msg}`);
      return NextResponse.json({ error: `No se pudo obtener el cliente de Flow. Intenta nuevamente.` }, { status: 500 });
    }
  }

  // 2. Iniciar registro de tarjeta usando el customerId interno de Flow
  const urlReturn = `${baseUrl}/api/billing/subscribe-return?restaurantId=${restaurantId}&plan=${plan}`;
  try {
    const result = await flowPost<{ url: string; token: string }>("/customer/register", {
      customerId: flowCustomerId,
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
