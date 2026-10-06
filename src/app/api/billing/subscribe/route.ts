import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { flowPost } from "@/lib/billing/flow";
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

  // Paso 1: crear cliente usando panelId como externalId.
  // Si ya existe (conflict por externalId), el cliente vive en Flow con externalId=panelId;
  // en ese caso usamos panelId directamente en /customer/register (Flow lo acepta como referencia).
  if (!flowCustomerId) {
    try {
      const created = await flowPost<{ customerId: string }>("/customer/create", {
        externalId: panelId,
        name: owner.name || owner.email.split("@")[0],
        email: owner.email,
      });
      flowCustomerId = created.customerId;
      await prisma.restaurant.update({ where: { id: restaurantId }, data: { flowCustomerId } });
      console.log(`[subscribe] Cliente creado: ${flowCustomerId}`);
    } catch (createErr: any) {
      // Ya existe → Flow tiene al cliente con externalId=panelId.
      // /customer/register acepta el externalId como customerId cuando no hay customerId numérico conocido.
      console.log(`[subscribe] create falló (ya existe), usando panelId: ${createErr?.message}`);
      flowCustomerId = panelId;
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
