import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LOYALTY_TRIAL_DAYS } from "@/lib/billing/plans-central";

/**
 * POST /api/billing/loyalty/start-trial
 * Activa 7 días de prueba del módulo Loyalty. Sin pago.
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

  if (restaurant.loyaltyStatus === "ACTIVE") {
    return NextResponse.json({ error: "Ya tienes Loyalty activo" }, { status: 409 });
  }
  if (restaurant.loyaltyStatus === "TRIALING") {
    return NextResponse.json({ error: "Ya tienes un periodo de prueba activo" }, { status: 409 });
  }

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + LOYALTY_TRIAL_DAYS);

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { loyaltyStatus: "TRIALING", loyaltyTrialEndsAt: trialEndsAt },
  });

  return NextResponse.json({ ok: true, loyaltyTrialEndsAt: trialEndsAt.toISOString() });
}
