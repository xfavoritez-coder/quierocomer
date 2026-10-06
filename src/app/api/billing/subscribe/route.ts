import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { flowPost } from "@/lib/billing/flow";
import { FLOW_PLANS } from "@/lib/billing/plans-config";

/**
 * POST /api/billing/subscribe
 * Body: { restaurantId, plan: "GOLD" | "PREMIUM" }
 *
 * /customer/create y /customer/register usan externalId=panelId como identificador.
 * El customerId interno de Flow se obtiene luego via getByRegisterToken en subscribe-return.
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
  let flowCustomerId = currentRestaurant?.flowCustomerId ?? null;

  // Paso 1: si no hay customerId en DB, crear cliente en Flow.
  // externalId = restaurantId (un Flow customer por restaurante, evita conflictos entre
  // restaurantes del mismo dueño y permite recuperar el customerId si se borra del DB).
  if (!flowCustomerId) {
    try {
      const created = await flowPost<{ customerId: string }>("/customer/create", {
        externalId: restaurantId,
        name: owner.name || owner.email.split("@")[0],
        email: owner.email,
      });
      flowCustomerId = created.customerId;
      await prisma.restaurant.update({ where: { id: restaurantId }, data: { flowCustomerId } });
      console.log(`[subscribe] Cliente Flow creado: ${flowCustomerId}`);
    } catch (createErr: any) {
      console.error(`[subscribe] Error creando cliente Flow: ${createErr?.message}`);
      return NextResponse.json({ error: `Error al crear cliente en Flow: ${createErr?.message}` }, { status: 500 });
    }
  }

  // Paso 2: iniciar registro de tarjeta con el customerId interno de Flow.
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
