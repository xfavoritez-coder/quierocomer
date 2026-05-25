import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TRIAL_DAYS } from "@/lib/billing/plans-central";

/**
 * Activates a 14-day Premium trial directly — no MercadoPago, no card.
 * Only for restaurants that haven't had a trial before.
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
  if (!owner || owner.status !== "ACTIVE") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const restaurant = owner.restaurants[0];
  if (!restaurant) return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });

  // Prevent double trial
  if (restaurant.trialEndsAt || restaurant.subscriptionStatus === "TRIALING") {
    return NextResponse.json({ error: "Ya usaste tu periodo de prueba" }, { status: 409 });
  }
  if (restaurant.plan === "PREMIUM" && restaurant.subscriptionStatus === "ACTIVE") {
    return NextResponse.json({ error: "Ya tienes Premium activo" }, { status: 409 });
  }

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      plan: "PREMIUM",
      subscriptionStatus: "TRIALING",
      trialEndsAt,
    },
  });

  return NextResponse.json({ ok: true, plan: "PREMIUM", trialEndsAt: trialEndsAt.toISOString() });
}
