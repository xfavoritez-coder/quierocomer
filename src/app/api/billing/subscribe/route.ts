import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { flowPost, flowGet } from "@/lib/billing/flow";
import { FLOW_PLANS } from "@/lib/billing/plans-config";

/**
 * POST /api/billing/subscribe
 * Body: { restaurantId, plan: "SILVER" | "GOLD" | "PREMIUM" }
 *
 * Inicia registro de tarjeta para cobro automático mensual vía Flow suscripciones.
 * Los planes ya existen en Flow (qc_gold_monthly, qc_premium_monthly).
 *
 * 1. Obtener customerId: getByExternalId(GET) → getList(GET, email) → customer/create(POST)
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

  // Opción 1: GET /customer/getByExternalId
  if (!flowCustomerId) {
    try {
      const existing = await flowGet<{ customerId: string; externalId: string }>("/customer/getByExternalId", {
        externalId: restaurantId,
      });
      if (existing?.customerId) {
        flowCustomerId = existing.customerId;
        await prisma.restaurant.update({ where: { id: restaurantId }, data: { flowCustomerId } });
        console.log(`[billing/subscribe] Cliente encontrado por externalId (GET): customerId=${flowCustomerId}`);
      }
    } catch (extErr: any) {
      console.log(`[billing/subscribe] getByExternalId sin resultado: ${extErr?.message}`);
    }
  }

  // Opción 2: GET /customer/getList filtrado por email
  if (!flowCustomerId) {
    try {
      const list = await flowGet<{ data: Array<{ customerId: string; email: string }> }>("/customer/getList", {
        filter: owner.email,
        start: 0,
        limit: 25,
      });
      const match = list?.data?.find((c: any) => c.email === owner.email);
      flowCustomerId = match?.customerId || null;
      if (flowCustomerId) {
        await prisma.restaurant.update({ where: { id: restaurantId }, data: { flowCustomerId } });
        console.log(`[billing/subscribe] Cliente encontrado por email (GET getList): customerId=${flowCustomerId}`);
      }
    } catch (listErr: any) {
      console.log(`[billing/subscribe] getList GET sin resultado: ${listErr?.message}`);
    }
  }

  // Opción 3: POST /customer/create
  if (!flowCustomerId) {
    try {
      const created = await flowPost<{ customerId: string }>("/customer/create", {
        externalId: restaurantId,
        name: owner.name || owner.email.split("@")[0],
        email: owner.email,
      });
      flowCustomerId = created.customerId;
      await prisma.restaurant.update({ where: { id: restaurantId }, data: { flowCustomerId } });
      console.log(`[billing/subscribe] Cliente creado en Flow: customerId=${flowCustomerId}`);
    } catch (createErr: any) {
      const msg = createErr?.message || "";
      const errData = (createErr as any).data;
      console.error(`[billing/subscribe] Error en /customer/create: ${msg} | data: ${JSON.stringify(errData)}`);

      // Si Flow devuelve el customerId del cliente existente en el error body, lo usamos
      if (errData?.customerId) {
        flowCustomerId = errData.customerId;
        await prisma.restaurant.update({ where: { id: restaurantId }, data: { flowCustomerId } });
        console.log(`[billing/subscribe] customerId extraído del error 401: ${flowCustomerId}`);
      }

      if (!flowCustomerId) {
        return NextResponse.json({
          error: `Error Flow (create): ${msg}`,
        }, { status: 500 });
      }
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
