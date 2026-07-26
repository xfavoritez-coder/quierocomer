import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { flowPost } from "@/lib/billing/flow";
import { FLOW_PLANS, grossOf, PLAN_LABELS, type PlanKey } from "@/lib/billing/plans-config";
import { sendAdminEmail, planActivatedEmailHtml } from "@/lib/email/sendAdminEmail";

/**
 * GET /api/billing/subscribe-return?restaurantId=X&plan=Y&token=Z
 *
 * Flow redirige aquí después de que el cliente registra su tarjeta.
 *
 * 1. Obtiene el customerId desde Flow (/customer/getByRegisterToken)
 * 2. Guarda flowCustomerId en DB
 * 3a. Si el local ya tiene plan ACTIVE → solo guarda la tarjeta (el cron cobrará el próximo mes)
 * 3b. Si no tiene plan activo → cobra el primer mes inmediatamente vía /payment/createByCustomer
 */
export async function GET(req: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.com";
  const { searchParams } = req.nextUrl;

  const token = searchParams.get("token");
  const restaurantId = searchParams.get("restaurantId");
  const planKey = searchParams.get("plan") as keyof typeof FLOW_PLANS | null;

  if (!token || !restaurantId || !planKey || !FLOW_PLANS[planKey]) {
    return NextResponse.redirect(new URL("/panel/mi-restaurante?autorenew=error&reason=par%C3%A1metros+inv%C3%A1lidos", req.url));
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: { owner: { select: { email: true, name: true } } },
  });
  if (!restaurant) {
    return NextResponse.redirect(new URL("/panel/mi-restaurante?autorenew=error&reason=restaurante+no+encontrado", req.url));
  }

  const planConfig = FLOW_PLANS[planKey];

  // 1. Obtener customerId desde el token de registro de tarjeta
  let customerId: string;
  try {
    const customer = await flowPost<{ customerId: string; name: string; email: string; status: number }>(
      "/customer/getByRegisterToken",
      { token }
    );
    customerId = customer.customerId;
    console.log(`[subscribe-return] Customer obtenido: ${customerId} para ${restaurant.name}`);
  } catch (err: any) {
    console.error(`[subscribe-return] Error getByRegisterToken: ${err?.message}`);
    return NextResponse.redirect(new URL(`/panel/mi-restaurante?autorenew=error&reason=${encodeURIComponent("Error al verificar la tarjeta. Intenta nuevamente.")}`, req.url));
  }

  // 2. Guardar customerId
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { flowCustomerId: customerId, pendingFlowPlanId: null },
  });

  // 3a. Si ya tiene plan activo → tarjeta registrada, el cron cobrará el próximo mes
  const isActive = restaurant.subscriptionStatus === "ACTIVE" && restaurant.currentPeriodEnd && new Date(restaurant.currentPeriodEnd) >= new Date();
  if (isActive) {
    console.log(`[subscribe-return] ✅ Tarjeta registrada para auto-renovación: ${restaurant.name} (plan ACTIVE, cron cobrará el ${restaurant.currentPeriodEnd?.toISOString().slice(0, 10)})`);
    return NextResponse.redirect(new URL("/panel/mi-restaurante?autorenew=ok", req.url));
  }

  // 3b. Sin plan activo → cobrar primer mes ahora
  const amountNet = restaurant.customPlanPriceNet ?? planConfig.amountNet;
  const amountGross = grossOf(amountNet);
  const commerceOrder = `auto_${restaurantId.slice(-8)}_${Date.now().toString(36)}`;

  let chargeToken: string;
  let chargeFlowOrder: number | null = null;
  try {
    const charge = await flowPost<{ token: string; flowOrder: number; url: string }>(
      "/payment/createByCustomer",
      {
        customerId,
        commerceOrder,
        subject: `${restaurant.name} — Plan ${PLAN_LABELS[planKey as keyof typeof PLAN_LABELS] || planKey}`,
        amount: amountGross,
        urlConfirmation: `${baseUrl}/api/billing/webhook`,
        urlReturn: `${baseUrl}/panel/mi-restaurante`,
      }
    );
    chargeToken = charge.token;
    chargeFlowOrder = charge.flowOrder || null;
    console.log(`[subscribe-return] Cobro automático iniciado: token=${chargeToken} order=${commerceOrder} para ${restaurant.name}`);
  } catch (err: any) {
    console.error(`[subscribe-return] Error payment/createByCustomer: ${err?.message}`);
    // Tarjeta guardada pero cobro falló — el cron lo intentará luego
    return NextResponse.redirect(new URL(`/panel/mi-restaurante?autorenew=charge_pending&reason=${encodeURIComponent("Tarjeta registrada. El primer cobro se procesará pronto.")}`, req.url));
  }

  // Guardar token para que el webhook pueda encontrar este restaurant
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      pendingFlowPlanId: planConfig.planId,
      flowRegisterToken: chargeFlowOrder ? `${chargeToken}|${chargeFlowOrder}` : chargeToken,
    },
  });

  return NextResponse.redirect(new URL("/panel/mi-restaurante?autorenew=charge_pending", req.url));
}
