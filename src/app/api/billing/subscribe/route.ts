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

  // Paso 1: asegurar que el cliente existe en Flow (externalId = panelId).
  // Si ya existe, ignorar el error — el cliente ya está ahí.
  try {
    const created = await flowPost<{ customerId: string }>("/customer/create", {
      externalId: panelId,
      name: owner.name || owner.email.split("@")[0],
      email: owner.email,
    });
    // Guardar el customerId interno de Flow si aún no lo tenemos
    if (created.customerId) {
      await prisma.restaurant.update({ where: { id: restaurantId }, data: { flowCustomerId: created.customerId } });
      console.log(`[subscribe] Cliente creado: ${created.customerId}`);
    }
  } catch (createErr: any) {
    console.log(`[subscribe] Cliente ya existe en Flow: ${createErr?.message}`);
  }

  // Paso 2: iniciar registro de tarjeta usando externalId=panelId.
  // /customer/register acepta externalId directamente — no requiere el customerId interno.
  const urlReturn = `${baseUrl}/api/billing/subscribe-return?restaurantId=${restaurantId}&plan=${plan}&cid=${encodeURIComponent(panelId)}`;
  try {
    const result = await flowPost<{ url: string; token: string }>("/customer/register", {
      externalId: panelId,
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
