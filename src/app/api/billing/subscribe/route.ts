import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { flowPost } from "@/lib/billing/flow";
import { FLOW_PLANS, grossOf } from "@/lib/billing/plans-config";

/**
 * POST /api/billing/subscribe
 * Body: { restaurantId, plan: "SILVER" | "GOLD" | "PREMIUM" }
 *
 * Inicia un cobro automático mensual vía Flow.cl:
 * 1. Crea el plan en Flow si no existe (/plan/create)
 * 2. Registra la tarjeta del cliente (/customer/register)
 * 3. Devuelve la URL de Flow donde el cliente ingresa su tarjeta
 *
 * Después de registrar la tarjeta, Flow redirige a /api/billing/subscribe-return
 * donde se crea la suscripción y se activa el plan.
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
    include: { restaurants: { where: { id: restaurantId }, select: { id: true, name: true, customPlanPriceNet: true }, take: 1 } },
  });
  if (!owner || owner.status !== "ACTIVE") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const restaurant = owner.restaurants[0];
  if (!restaurant) return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });

  const planConfig = FLOW_PLANS[plan];
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.com";
  const amountNet = restaurant.customPlanPriceNet ?? planConfig.amountNet;
  const amountGross = grossOf(amountNet);

  // 1. Asegurar que el plan exista en Flow
  try {
    await flowPost("/plan/create", {
      planId: planConfig.planId,
      name: planConfig.name,
      currency: "CLP",
      amount: amountGross,
      interval: 1,        // mensual
      intervalCount: 1,
      trialPeriodDays: 0,
      urlCallback: `${baseUrl}/api/billing/webhook`,
    });
    console.log(`[billing/subscribe] Plan creado en Flow: ${planConfig.planId}`);
  } catch (err: any) {
    // El plan ya existe → ignorar el error
    const alreadyExists = err?.code === 400 || err?.message?.includes("already") || err?.message?.includes("existe");
    if (!alreadyExists) {
      console.error("[billing/subscribe] Error creando plan en Flow:", err?.message);
      return NextResponse.json({ error: `Error configurando plan: ${err?.message}` }, { status: 500 });
    }
    console.log(`[billing/subscribe] Plan ya existe en Flow: ${planConfig.planId}`);
  }

  // 2. Registrar tarjeta del cliente
  const urlReturn = `${baseUrl}/api/billing/subscribe-return?restaurantId=${restaurantId}&plan=${plan}`;
  let customerUrl: string;
  let customerToken: string;
  try {
    const result = await flowPost<{ url: string; token: string }>("/customer/register", {
      name: owner.name || owner.email.split("@")[0],
      email: owner.email,
      externalId: restaurantId,
      urlReturn,
    });
    customerUrl = result.url;
    customerToken = result.token;
    console.log(`[billing/subscribe] Customer registration iniciado: token=${customerToken}`);
  } catch (err: any) {
    console.error("[billing/subscribe] Error registrando cliente en Flow:", err?.message);
    return NextResponse.json({ error: `Error al iniciar registro de tarjeta: ${err?.message}` }, { status: 500 });
  }

  // Guardar intent pendiente
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      pendingFlowPlanId: planConfig.planId,
      flowRegisterToken: `sub_intent|${customerToken}`,
    },
  });

  return NextResponse.json({ url: `${customerUrl}?token=${customerToken}` });
}
