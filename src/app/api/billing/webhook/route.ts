import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMPPayment } from "@/lib/billing/mercadopago";
import { planFromFlowId } from "@/lib/billing/plans-config";
import crypto from "crypto";

/**
 * POST /api/billing/webhook
 *
 * MercadoPago envía notificaciones IPN de pagos a esta URL.
 * Procesa pagos aprobados para activar o renovar planes.
 */
export async function POST(req: NextRequest) {
  // Verificar firma del webhook
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (secret) {
    const xSignature = req.headers.get("x-signature") || "";
    const xRequestId = req.headers.get("x-request-id") || "";
    const dataId = req.nextUrl.searchParams.get("data.id") || "";

    const parts = Object.fromEntries(xSignature.split(",").map(p => { const [k, v] = p.trim().split("="); return [k, v]; }));
    const ts = parts["ts"] || "";
    const hash = parts["v1"] || "";

    if (hash) {
      const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
      const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
      if (expected !== hash) {
        console.error("[billing/webhook] Firma inválida");
        return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
      }
    }
  }

  let payload: { type?: string; action?: string; data?: { id?: string } };
  try { payload = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 });
  }

  const { type, data } = payload;

  // Procesar pagos aprobados
  if (type === "payment" && data?.id) {
    try {
      const mpPayment = await getMPPayment(data.id);

      if (mpPayment.status !== "approved") {
        return NextResponse.json({ ok: true, ignored: true, reason: "not_approved" });
      }

      const restaurantId = mpPayment.externalReference;
      if (!restaurantId) {
        return NextResponse.json({ ok: true, ignored: true, reason: "no_reference" });
      }

      const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
      if (!restaurant) {
        return NextResponse.json({ ok: true, ignored: true, reason: "restaurant_not_found" });
      }

      const appPlan = restaurant.pendingMpPlanId
        ? (planFromFlowId(restaurant.pendingMpPlanId) || restaurant.plan)
        : restaurant.plan;
      const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await prisma.restaurant.update({
        where: { id: restaurant.id },
        data: {
          plan: appPlan,
          subscriptionStatus: "ACTIVE",
          mpPlanId: restaurant.pendingMpPlanId || restaurant.mpPlanId,
          currentPeriodEnd: periodEnd,
          lastPaymentAt: new Date(),
          pendingMpPlanId: null,
        },
      });

      console.log(`[billing/webhook] Pago aprobado: ${restaurant.name} → ${appPlan}`);
      return NextResponse.json({ ok: true, plan: appPlan });
    } catch (err: any) {
      console.error("[billing/webhook] Error procesando pago:", err?.message);
      return NextResponse.json({ ok: true, error: "processing_failed" });
    }
  }

  // Ignorar otros tipos de notificación (subscription_preapproval legacy, etc.)
  return NextResponse.json({ ok: true, ignored: true });
}
