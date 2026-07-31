import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { flowPost } from "@/lib/billing/flow";
import { grossOf } from "@/lib/billing/plans-config";
import { LOYALTY_PLAN_NET } from "@/lib/billing/plans-central";

/**
 * POST /api/billing/loyalty/start
 * Inicia un pago Flow para activar/renovar el módulo Loyalty.
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
    include: { restaurants: { where: { id: restaurantId }, select: { id: true, name: true, loyaltyStatus: true, loyaltyPeriodEnd: true }, take: 1 } },
  });
  if (!owner || owner.status !== "ACTIVE") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const restaurant = owner.restaurants[0];
  if (!restaurant) return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.com";
  const amountGross = grossOf(LOYALTY_PLAN_NET);
  const commerceOrder = `ly_${restaurantId.slice(-8)}_${Date.now().toString(36)}`;

  try {
    const payment = await flowPost<{ url: string; token: string; flowOrder: number }>("/payment/create", {
      commerceOrder,
      subject: `${restaurant.name} — Loyalty Fidelización (1 mes)`,
      amount: amountGross,
      email: owner.email,
      urlConfirmation: `${baseUrl}/api/billing/webhook`,
      urlReturn: `${baseUrl}/api/billing/loyalty/return`,
    });

    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { loyaltyFlowRegisterToken: `${payment.token}|${payment.flowOrder}` },
    });

    return NextResponse.json({ url: `${payment.url}?token=${payment.token}` });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error desconocido" }, { status: 500 });
  }
}
