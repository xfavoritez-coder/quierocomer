import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { flowPost } from "@/lib/billing/flow";
import { FLOW_PLANS, PLAN_LABELS, grossOf, type PlanKey } from "@/lib/billing/plans-config";
import { sendAdminEmail, planActivatedEmailHtml, monthlyRenewalEmailHtml } from "@/lib/email/sendAdminEmail";

/**
 * GET /api/billing/subscribe-return?restaurantId=X&plan=Y&token=Z
 *
 * Flow redirige aquí después de que el cliente registra su tarjeta.
 * 1. Obtiene el customerId desde Flow (/customer/getByRegisterToken)
 * 2. Crea la suscripción (/subscription/subscribe) → primer cobro inmediato
 * 3. Guarda flowCustomerId y flowSubscriptionId en DB
 * 4. El plan se activa cuando el webhook confirma el primer cobro
 */
export async function GET(req: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.com";
  const { searchParams } = req.nextUrl;

  const token = searchParams.get("token");
  const restaurantId = searchParams.get("restaurantId");
  const planKey = searchParams.get("plan") as keyof typeof FLOW_PLANS | null;

  if (!token || !restaurantId || !planKey || !FLOW_PLANS[planKey]) {
    return NextResponse.redirect(new URL("/panel/mi-restaurante?status=error&reason=Parámetros inválidos", req.url));
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: { owner: { select: { email: true, name: true } } },
  });
  if (!restaurant) {
    return NextResponse.redirect(new URL("/panel/mi-restaurante?status=error&reason=Restaurante no encontrado", req.url));
  }

  const planConfig = FLOW_PLANS[planKey];

  // 1. Obtener customerId desde el token de registro
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
    return NextResponse.redirect(new URL(`/panel/mi-restaurante?status=error&reason=${encodeURIComponent("Error al verificar la tarjeta registrada")}`, req.url));
  }

  // 2. Suscribir al plan (primer cobro inmediato con startDate = hoy)
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  let subscriptionId: string;
  try {
    const sub = await flowPost<{ subscriptionId: string; status: string; planId: string }>(
      "/subscription/subscribe",
      {
        planId: planConfig.planId,
        customerId,
        startDate: today,
        trialPeriodDays: 0,
      }
    );
    subscriptionId = sub.subscriptionId;
    console.log(`[subscribe-return] Suscripción creada: ${subscriptionId} para ${restaurant.name}`);
  } catch (err: any) {
    console.error(`[subscribe-return] Error subscription/subscribe: ${err?.message}`);
    // Guardar customerId aunque falle la suscripción (para reintentar)
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { flowCustomerId: customerId, flowRegisterToken: null },
    });
    return NextResponse.redirect(new URL(`/panel/mi-restaurante?status=error&reason=${encodeURIComponent("Tarjeta registrada, pero error al crear suscripción. Contacta soporte.")}`, req.url));
  }

  // 3. Guardar IDs en DB — el plan se activará cuando llegue el webhook del primer cobro
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      flowCustomerId: customerId,
      flowSubscriptionId: subscriptionId,
      pendingFlowPlanId: planConfig.planId,
      flowRegisterToken: null,
    },
  });

  console.log(`[subscribe-return] ✅ Suscripción activa: ${restaurant.name} → ${planKey} (sub: ${subscriptionId})`);

  // Redirigir a Mi Restaurante con estado pendiente — el webhook activará el plan
  return NextResponse.redirect(new URL(`/panel/mi-restaurante?status=pending&reason=${encodeURIComponent("Suscripción activada. Tu plan se habilitará en unos momentos.")}`, req.url));
}
