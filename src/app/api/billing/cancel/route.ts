import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cancelMPSubscription } from "@/lib/billing/mercadopago";

/**
 * POST /api/billing/cancel
 * Body: { restaurantId }
 *
 * Cancela el plan. El restaurante mantiene acceso hasta el final del periodo
 * pagado (currentPeriodEnd), después baja a FREE automáticamente (vía cron).
 *
 * Si hay una suscripción recurrente legacy en MP, también se cancela.
 */
export async function POST(req: NextRequest) {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let body: { restaurantId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }
  const { restaurantId } = body;
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });

  const owner = await prisma.restaurantOwner.findUnique({
    where: { id: panelId },
    include: { restaurants: { where: { id: restaurantId }, take: 1 } },
  });
  const restaurant = owner?.restaurants[0];
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });
  }

  // Si hay suscripción recurrente legacy en MP, cancelarla
  if (restaurant.mpSubscriptionId) {
    try {
      await cancelMPSubscription(restaurant.mpSubscriptionId);
    } catch (err: any) {
      console.warn("[billing/cancel] cancelMPSubscription falló:", err?.message);
    }
  }

  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: {
      subscriptionStatus: "CANCELED",
      mpSubscriptionId: null,
    },
  });

  return NextResponse.json({ ok: true });
}
