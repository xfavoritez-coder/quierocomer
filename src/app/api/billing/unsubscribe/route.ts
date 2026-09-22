import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { flowPost } from "@/lib/billing/flow";

/**
 * POST /api/billing/unsubscribe
 * Body: { restaurantId }
 *
 * Cancela la suscripción recurrente en Flow y limpia flowSubscriptionId en DB.
 * El plan sigue activo hasta currentPeriodEnd — no se cobra más.
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
    include: {
      restaurants: {
        where: { id: restaurantId },
        select: { id: true, name: true, flowSubscriptionId: true },
        take: 1,
      },
    },
  });
  const restaurant = owner?.restaurants[0];
  if (!restaurant) return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });

  const { flowSubscriptionId } = restaurant;
  if (!flowSubscriptionId) return NextResponse.json({ error: "No hay suscripción activa" }, { status: 400 });

  // Cancelar en Flow
  try {
    await flowPost("/subscription/cancel", { subscriptionId: flowSubscriptionId });
    console.log(`[unsubscribe] ✅ Suscripción cancelada en Flow: ${flowSubscriptionId} para ${restaurant.name}`);
  } catch (err: any) {
    console.error(`[unsubscribe] Error Flow /subscription/cancel: ${err?.message}`);
    // Si Flow da error, igual limpiamos en DB para no bloquear al usuario
  }

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { flowSubscriptionId: null, pendingFlowPlanId: null },
  });

  return NextResponse.json({ ok: true });
}
