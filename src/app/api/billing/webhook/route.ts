import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMPSubscription } from "@/lib/billing/mercadopago";
import type { SubscriptionStatus } from "@prisma/client";

/**
 * POST /api/billing/webhook
 *
 * MercadoPago envia notificaciones de eventos de suscripcion a esta URL.
 * El payload es JSON con { type, action, data: { id } }.
 *
 * Tipos relevantes:
 * - "subscription_preapproval": cambios en el estado de la suscripcion
 *
 * Siempre consultamos el estado real en la API de MP para no confiar
 * solo en el payload del webhook.
 */
export async function POST(req: NextRequest) {
  let payload: { type?: string; action?: string; data?: { id?: string } };
  try { payload = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "Body invalido" }, { status: 400 });
  }

  const { type, data } = payload;

  // Solo procesamos eventos de suscripcion (preapproval)
  if (type !== "subscription_preapproval" || !data?.id) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const subscriptionId = data.id;

  // Consultar estado real en MercadoPago
  let mpSub;
  try {
    mpSub = await getMPSubscription(subscriptionId);
  } catch (err: any) {
    console.error("[billing/webhook] getMPSubscription fallo:", err?.message);
    // Retornamos 200 para que MP no reintente indefinidamente
    return NextResponse.json({ ok: true, error: "fetch_failed" });
  }

  const restaurant = await prisma.restaurant.findFirst({
    where: { mpSubscriptionId: subscriptionId },
  });
  if (!restaurant) {
    // Podria ser una suscripcion que aun no se asocio (pendiente en /return)
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Mapeo de status MercadoPago → SubscriptionStatus de la app:
  //   authorized → ACTIVE
  //   paused     → PAST_DUE
  //   cancelled  → CANCELED
  //   pending    → TRIALING
  let appStatus: SubscriptionStatus;
  switch (mpSub.status) {
    case "authorized":
      appStatus = "ACTIVE";
      break;
    case "paused":
      appStatus = "PAST_DUE";
      break;
    case "cancelled":
      appStatus = "CANCELED";
      break;
    case "pending":
      appStatus = "TRIALING";
      break;
    default:
      appStatus = "UNPAID";
      break;
  }

  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: {
      subscriptionStatus: appStatus,
      currentPeriodEnd: mpSub.nextPaymentDate
        ? new Date(mpSub.nextPaymentDate)
        : restaurant.currentPeriodEnd,
    },
  });

  return NextResponse.json({ ok: true });
}
