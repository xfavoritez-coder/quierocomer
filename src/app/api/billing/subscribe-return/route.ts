import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { flowPost } from "@/lib/billing/flow";
import { FLOW_PLANS, type PlanKey } from "@/lib/billing/plans-config";

/**
 * GET|POST /api/billing/subscribe-return?restaurantId=X&plan=Y&token=Z
 *
 * Flow redirige aquí después de que el cliente registra su tarjeta.
 * 1. /customer/getByRegisterToken → obtiene customerId interno de Flow
 * 2. /subscription/subscribe      → suscribe al plan existente (qc_gold_monthly, etc.)
 * 3. Flow cobra mensualmente y envía webhook → webhook activa/renueva el plan
 */
async function handleSubscribeReturn(req: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.com";
  const { searchParams } = req.nextUrl;

  let token = searchParams.get("token");
  const restaurantId = searchParams.get("restaurantId");
  const planKey = searchParams.get("plan") as keyof typeof FLOW_PLANS | null;
  const cidParam = searchParams.get("cid"); // flowCustomerId pasado desde /subscribe como fallback

  // Flow puede enviar el token via POST form-data
  if (!token && req.method === "POST") {
    try {
      const form = await req.formData();
      token = (form.get("token") as string) || null;
    } catch {}
  }

  if (!token || !restaurantId || !planKey || !FLOW_PLANS[planKey]) {
    return NextResponse.redirect(new URL("/panel/mi-restaurante?autorenew=error&reason=Par%C3%A1metros+inv%C3%A1lidos", req.url), 303);
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: { owner: { select: { email: true, name: true } } },
  });
  if (!restaurant) {
    return NextResponse.redirect(new URL("/panel/mi-restaurante?autorenew=error&reason=Restaurante+no+encontrado", req.url), 303);
  }

  const planConfig = FLOW_PLANS[planKey];

  // 1. Obtener customerId de Flow usando el token de registro
  // Si falla (e.g. "No services available"), usamos cidParam pasado desde /subscribe
  let customerId: string;
  try {
    const customer = await flowPost<{ customerId: string; externalId: string; status: number }>(
      "/customer/getByRegisterToken",
      { token }
    );
    customerId = customer.customerId;
    console.log(`[subscribe-return] Customer obtenido: customerId=${customerId} para ${restaurant.name}`);
  } catch (err: any) {
    const detail = err?.message || "desconocido";
    console.error(`[subscribe-return] Error getByRegisterToken: ${detail} | token=${token}`);
    if (cidParam) {
      customerId = cidParam;
      console.log(`[subscribe-return] Usando cid fallback: ${customerId} para ${restaurant.name}`);
    } else {
      return NextResponse.redirect(new URL(`/panel/mi-restaurante?autorenew=error&reason=${encodeURIComponent("Error tarjeta: " + detail)}`, req.url), 303);
    }
  }

  // Guardar customerId
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { flowCustomerId: customerId },
  });

  // 2. Si ya tiene plan activo → solo guardamos la tarjeta, Flow cobrará el mes que viene
  const periodEnd = restaurant.currentPeriodEnd ? new Date(restaurant.currentPeriodEnd) : null;
  const isActive = restaurant.subscriptionStatus === "ACTIVE" && periodEnd && periodEnd >= new Date();
  if (isActive) {
    // Crear suscripción que empieza cuando vence el período actual
    const startDate = periodEnd!.toISOString().slice(0, 10); // YYYY-MM-DD
    try {
      const sub = await flowPost<{ subscriptionId: string; status: string }>(
        "/subscription/subscribe",
        { planId: planConfig.planId, customerId, startDate, trialPeriodDays: 0 }
      );
      await prisma.restaurant.update({
        where: { id: restaurantId },
        data: { flowSubscriptionId: sub.subscriptionId, pendingFlowPlanId: null },
      });
      console.log(`[subscribe-return] ✅ Suscripción creada (diferida): ${restaurant.name} → ${planKey} desde ${startDate} (sub: ${sub.subscriptionId})`);
    } catch (err: any) {
      console.error(`[subscribe-return] Error subscription/subscribe (diferida): ${err?.message}`);
      // Tarjeta guardada aunque falle la suscripción — el cron puede cobrar igual
    }
    return NextResponse.redirect(new URL("/panel/mi-restaurante?autorenew=ok", req.url), 303);
  }

  // 3. Sin plan activo → suscribir con cobro inmediato (startDate = hoy)
  const today = new Date().toISOString().slice(0, 10);
  try {
    const sub = await flowPost<{ subscriptionId: string; status: string }>(
      "/subscription/subscribe",
      { planId: planConfig.planId, customerId, startDate: today, trialPeriodDays: 0 }
    );
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        flowSubscriptionId: sub.subscriptionId,
        pendingFlowPlanId: planConfig.planId,
        flowPlanId: planConfig.planId,
      },
    });
    console.log(`[subscribe-return] ✅ Suscripción con cobro inmediato: ${restaurant.name} → ${planKey} (sub: ${sub.subscriptionId})`);
  } catch (err: any) {
    console.error(`[subscribe-return] Error subscription/subscribe: ${err?.message}`);
    return NextResponse.redirect(new URL(`/panel/mi-restaurante?autorenew=error&reason=${encodeURIComponent("Tarjeta registrada, pero error al crear suscripción: " + err?.message)}`, req.url), 303);
  }

  return NextResponse.redirect(new URL("/panel/mi-restaurante?autorenew=charge_pending", req.url), 303);
}

export async function GET(req: NextRequest) { return handleSubscribeReturn(req); }
export async function POST(req: NextRequest) { return handleSubscribeReturn(req); }
