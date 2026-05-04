import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { flowPost } from "@/lib/billing/flow";
import type { SubscriptionStatus } from "@prisma/client";

/**
 * POST /api/billing/webhook
 *
 * Flow notifica eventos de subscription/payment a esta URL. La firma viene
 * en el body como `s`, pero los webhooks de Flow generalmente solo mandan
 * un identificador (token o subscriptionId) y hay que ir a consultar el
 * detalle a la API. Hacemos eso para asegurarnos del estado actual.
 *
 * Notas:
 * - Flow puede mandar webhooks de varios eventos: pago exitoso, fallido,
 *   suscripcion cancelada, tarjeta vencida.
 * - El payload no es estable entre eventos, asi que consultamos el estado
 *   real en vez de confiar en el payload.
 */
export async function POST(req: NextRequest) {
  let formData: FormData;
  try { formData = await req.formData(); } catch {
    return NextResponse.json({ ok: false, error: "Body invalido" }, { status: 400 });
  }

  const token = (formData.get("token") as string | null) || null;
  const subscriptionId = (formData.get("subscriptionId") as string | null) || null;

  if (!token && !subscriptionId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  let flowSubId = subscriptionId;
  if (!flowSubId && token) {
    try {
      const status = await flowPost<{ subscriptionMeId?: string }>("/customer/getRegisterStatus", { token });
      flowSubId = status.subscriptionMeId || null;
    } catch {/* sigue */}
  }
  if (!flowSubId) return NextResponse.json({ ok: true, ignored: true });

  const sub = await flowPost<{
    subscriptionId: string;
    status: number;
    morose: number;
    next_invoice_date?: string;
    last_payment_date?: string;
    cancel_at_period_end?: number;
  }>("/subscription/get", { subscriptionId: flowSubId });

  const restaurant = await prisma.restaurant.findFirst({ where: { flowSubscriptionId: flowSubId } });
  if (!restaurant) return NextResponse.json({ ok: true, ignored: true });

  // Mapeo de status Flow:
  //   0 = inactiva, 1 = activa, 2 = en periodo de prueba, 4 = cancelada
  // morose: 1 = en mora
  let appStatus: SubscriptionStatus = "ACTIVE";
  if (sub.status === 4) appStatus = "CANCELED";
  else if (sub.status === 2) appStatus = "TRIALING";
  else if (sub.status === 0) appStatus = "UNPAID";
  if (sub.morose === 1 && appStatus === "ACTIVE") appStatus = "PAST_DUE";

  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: {
      subscriptionStatus: appStatus,
      currentPeriodEnd: sub.next_invoice_date ? new Date(sub.next_invoice_date) : restaurant.currentPeriodEnd,
      lastPaymentAt: sub.last_payment_date ? new Date(sub.last_payment_date) : restaurant.lastPaymentAt,
    },
  });

  return NextResponse.json({ ok: true });
}
