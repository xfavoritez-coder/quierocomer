import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { flowPost } from "@/lib/billing/flow";
import { FLOW_PLANS } from "@/lib/billing/plans-config";

/**
 * POST /api/billing/subscribe
 * Body: { restaurantId, plan: "SILVER" | "GOLD" | "PREMIUM" }
 *
 * Registra la tarjeta del cliente en Flow para cobros automáticos futuros.
 * No usa el sistema de suscripciones/planes de Flow — el cron diario
 * cobra via /payment/createByCustomer cada mes.
 *
 * Flujo:
 * 1. /customer/register → URL donde el cliente ingresa su tarjeta
 * 2. Flow redirige a /api/billing/subscribe-return con el token
 * 3. subscribe-return guarda flowCustomerId y activa si corresponde
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

  // Registrar tarjeta del cliente en Flow
  const urlReturn = `${baseUrl}/api/billing/subscribe-return?restaurantId=${restaurantId}&plan=${plan}`;
  try {
    const result = await flowPost<{ url: string; token: string }>("/customer/register", {
      name: owner.name || owner.email.split("@")[0],
      email: owner.email,
      externalId: restaurantId,
      urlReturn,
    });
    console.log(`[billing/subscribe] Customer registration iniciado: token=${result.token} para ${restaurant.name}`);

    // Guardar plan pendiente
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { pendingFlowPlanId: planConfig.planId },
    });

    return NextResponse.json({ url: `${result.url}?token=${result.token}` });
  } catch (err: any) {
    console.error("[billing/subscribe] Error registrando cliente en Flow:", err?.message);
    return NextResponse.json({ error: `Error al iniciar registro de tarjeta: ${err?.message}` }, { status: 500 });
  }
}
