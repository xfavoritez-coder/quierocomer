import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cancelMPSubscription } from "@/lib/billing/mercadopago";

/**
 * POST /api/billing/cancel
 * Body: { restaurantId, atPeriodEnd?: boolean }
 *
 * Cancela la suscripcion en MercadoPago. El cliente sigue accediendo
 * hasta que vence el periodo actual (currentPeriodEnd).
 */
export async function POST(req: NextRequest) {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let body: { restaurantId?: string; atPeriodEnd?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body invalido" }, { status: 400 }); }
  const { restaurantId, atPeriodEnd = true } = body;
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });

  const owner = await prisma.restaurantOwner.findUnique({
    where: { id: panelId },
    include: { restaurants: { where: { id: restaurantId }, take: 1 } },
  });
  const restaurant = owner?.restaurants[0];
  if (!restaurant || !restaurant.mpSubscriptionId) {
    return NextResponse.json({ error: "Sin suscripcion activa" }, { status: 404 });
  }

  await cancelMPSubscription(restaurant.mpSubscriptionId);

  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: { subscriptionStatus: "CANCELED" },
  });

  return NextResponse.json({ ok: true, atPeriodEnd });
}
