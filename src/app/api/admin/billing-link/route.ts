import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth } from "@/lib/adminAuth";
import { createMPCustomer, createMPSubscription } from "@/lib/billing/mercadopago";
import { grossOf } from "@/lib/billing/plans-config";

/**
 * POST /api/admin/billing-link
 * Body: { restaurantId, amountNet: number (CLP), plan?: "PREMIUM" }
 *
 * Creates a custom MercadoPago subscription link for a restaurant.
 * Used for special pricing agreements (e.g., Alleria $50.000 + IVA).
 */
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const body = await req.json().catch(() => null);
  if (!body?.restaurantId || !body?.amountNet) {
    return NextResponse.json({ error: "restaurantId y amountNet requeridos" }, { status: 400 });
  }

  const { restaurantId, amountNet, plan = "PREMIUM" } = body;
  const amountGross = grossOf(amountNet);

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: { owner: { select: { email: true, name: true } } },
  });
  if (!restaurant) return NextResponse.json({ error: "Restaurant no encontrado" }, { status: 404 });
  if (!restaurant.owner?.email) return NextResponse.json({ error: "Owner sin email" }, { status: 400 });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";

  try {
    // Create MP customer if needed
    if (!restaurant.mpCustomerId) {
      try {
        const customer = await createMPCustomer(restaurant.owner.email, restaurant.name);
        await prisma.restaurant.update({ where: { id: restaurant.id }, data: { mpCustomerId: customer.id } });
      } catch {}
    }

    // Create custom subscription directly via PreApproval API
    const { initMercadoPago } = await import("@/lib/billing/mercadopago");
    const { PreApproval } = await import("mercadopago");
    const config = initMercadoPago();
    const preApprovalClient = new PreApproval(config);

    const result = await preApprovalClient.create({
      body: {
        reason: `QuieroComer ${plan} — ${restaurant.name}`,
        payer_email: restaurant.owner.email,
        external_reference: restaurantId,
        back_url: `${baseUrl}/api/billing/return?plan=${plan}`,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: amountGross,
          currency_id: "CLP",
        },
        status: "pending",
      },
    });

    if (!result.id || !result.init_point) {
      return NextResponse.json({ error: "MP no retornó link" }, { status: 500 });
    }

    // Mark pending plan
    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { pendingMpPlanId: `qc_${plan.toLowerCase()}_monthly` },
    });

    return NextResponse.json({
      url: result.init_point,
      subscriptionId: result.id,
      restaurant: restaurant.name,
      owner: restaurant.owner.name,
      email: restaurant.owner.email,
      amountNet,
      amountGross,
      plan,
    });
  } catch (err: any) {
    console.error("[admin/billing-link]", err);
    return NextResponse.json({ error: err?.message || "Error desconocido" }, { status: 500 });
  }
}
