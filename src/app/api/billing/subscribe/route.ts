import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { flowPost, flowGet } from "@/lib/billing/flow";
import { FLOW_PLANS } from "@/lib/billing/plans-config";

/**
 * POST /api/billing/subscribe
 * Body: { restaurantId, plan: "GOLD" | "PREMIUM" }
 *
 * externalId en Flow = panelId (ID del dueño), NO el restaurantId.
 * Esto evita conflictos con clientes previos creados con restaurantId.
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

  // Obtener flowCustomerId guardado en DB
  const currentRestaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { flowCustomerId: true },
  });
  let flowCustomerId = currentRestaurant?.flowCustomerId || null;

  const debug: string[] = [];

  // Paso 1a: buscar en Flow por externalId=panelId (GET)
  if (!flowCustomerId) {
    try {
      const existing = await flowGet<{ customerId: string }>("/customer/getByExternalId", { externalId: panelId });
      if (existing?.customerId) {
        flowCustomerId = existing.customerId;
        await prisma.restaurant.update({ where: { id: restaurantId }, data: { flowCustomerId } });
        console.log(`[subscribe] Cliente encontrado por externalId GET: ${flowCustomerId}`);
        debug.push(`getByExternalId(GET) ok: ${flowCustomerId}`);
      } else {
        debug.push(`getByExternalId(GET) sin customerId: ${JSON.stringify(existing)}`);
      }
    } catch (e: any) {
      debug.push(`getByExternalId(GET) err: ${e?.message}`);
      console.log(`[subscribe] getByExternalId GET falló: ${e?.message}`);
    }
  }

  // Paso 1b: intentar con POST si GET falló
  if (!flowCustomerId) {
    try {
      const existing = await flowPost<{ customerId: string }>("/customer/getByExternalId", { externalId: panelId });
      if (existing?.customerId) {
        flowCustomerId = existing.customerId;
        await prisma.restaurant.update({ where: { id: restaurantId }, data: { flowCustomerId } });
        console.log(`[subscribe] Cliente encontrado por externalId POST: ${flowCustomerId}`);
        debug.push(`getByExternalId(POST) ok: ${flowCustomerId}`);
      } else {
        debug.push(`getByExternalId(POST) sin customerId: ${JSON.stringify(existing)}`);
      }
    } catch (e: any) {
      debug.push(`getByExternalId(POST) err: ${e?.message}`);
      console.log(`[subscribe] getByExternalId POST falló: ${e?.message}`);
    }
  }

  // Paso 2: buscar en Flow por email del owner
  if (!flowCustomerId) {
    try {
      const list = await flowGet<{ data: Array<{ customerId: string; email: string }> }>("/customer/getList", {
        filter: owner.email,
        start: 0,
        limit: 25,
      });
      const match = list?.data?.find((c: any) => c.email === owner.email);
      if (match?.customerId) {
        flowCustomerId = match.customerId;
        await prisma.restaurant.update({ where: { id: restaurantId }, data: { flowCustomerId } });
        console.log(`[subscribe] Cliente encontrado por email: ${flowCustomerId}`);
        debug.push(`getList ok: ${flowCustomerId}`);
      } else {
        debug.push(`getList sin match (total: ${list?.data?.length ?? 0})`);
      }
    } catch (e: any) {
      debug.push(`getList err: ${e?.message}`);
      console.log(`[subscribe] getList falló: ${e?.message}`);
    }
  }

  // Paso 3: crear cliente nuevo en Flow usando panelId como externalId
  if (!flowCustomerId) {
    try {
      const created = await flowPost<{ customerId: string }>("/customer/create", {
        externalId: panelId,
        name: owner.name || owner.email.split("@")[0],
        email: owner.email,
      });
      flowCustomerId = created.customerId;
      await prisma.restaurant.update({ where: { id: restaurantId }, data: { flowCustomerId } });
      console.log(`[subscribe] Cliente creado (externalId=panelId): ${flowCustomerId}`);
      debug.push(`create ok: ${flowCustomerId}`);
    } catch (createErr: any) {
      const errData = (createErr as any).data;
      debug.push(`create err: ${createErr?.message} | data: ${JSON.stringify(errData)}`);
      console.error(`[subscribe] Error create: ${createErr?.message} | data: ${JSON.stringify(errData)}`);
      if (errData?.customerId) {
        flowCustomerId = errData.customerId;
        await prisma.restaurant.update({ where: { id: restaurantId }, data: { flowCustomerId } });
        debug.push(`create errData.customerId: ${flowCustomerId}`);
        console.log(`[subscribe] customerId del error body: ${flowCustomerId}`);
      }
      if (!flowCustomerId) {
        return NextResponse.json({ error: `Flow debug: ${debug.join(" | ")}`, debug }, { status: 500 });
      }
    }
  }

  // Iniciar registro de tarjeta (cid = flowCustomerId como fallback para subscribe-return)
  const urlReturn = `${baseUrl}/api/billing/subscribe-return?restaurantId=${restaurantId}&plan=${plan}&cid=${encodeURIComponent(flowCustomerId!)}`;
  try {
    const result = await flowPost<{ url: string; token: string }>("/customer/register", {
      customerId: flowCustomerId,
      url_return: urlReturn,
    });
    console.log(`[subscribe] Card registration iniciado: token=${result.token} para ${restaurant.name}`);
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { pendingFlowPlanId: planConfig.planId },
    });
    return NextResponse.json({ url: `${result.url}?token=${result.token}` });
  } catch (err: any) {
    console.error("[subscribe] Error en /customer/register:", err?.message);
    return NextResponse.json({ error: `Error al iniciar registro de tarjeta: ${err?.message}` }, { status: 500 });
  }
}
