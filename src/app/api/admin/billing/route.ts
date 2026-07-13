import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { planNetAmount } from "@/lib/billing/plans-config";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const restaurants = await prisma.restaurant.findMany({
    where: {
      ownerId: { not: null },
      isDemo: false,
      OR: [
        { plan: { not: "FREE" } },
        { subscriptionStatus: { not: "NONE" } },
        { billingExempt: true },
      ],
    },
    select: {
      id: true, name: true, plan: true, subscriptionStatus: true,
      currentPeriodEnd: true, lastPaymentAt: true, trialEndsAt: true,
      billingExempt: true, mpPayerEmail: true, customPlanPriceNet: true,
      flowPlanId: true, flowSubscriptionId: true,
    },
    orderBy: { currentPeriodEnd: "desc" },
  });

  const restaurantIds = restaurants.map(r => r.id);

  // Detect manual payments via PanelActivity log
  const manualPaymentLogs = await prisma.panelActivity.findMany({
    where: { restaurantId: { in: restaurantIds }, action: "manual_payment" },
    select: { restaurantId: true, details: true },
    orderBy: { createdAt: "desc" },
  });

  const manualMethodByRestaurant = new Map<string, string>();
  for (const log of manualPaymentLogs) {
    if (!manualMethodByRestaurant.has(log.restaurantId)) {
      const d = log.details as any;
      const label = d?.methodLabel || d?.method || "Manual";
      manualMethodByRestaurant.set(log.restaurantId, label);
    }
  }

  const now = Date.now();

  const rows = restaurants.map(r => {
    const net = r.customPlanPriceNet ?? planNetAmount(r.plan as any);
    const iva = Math.round(net * 0.19);
    const gross = net + iva;
    const daysLeft = r.currentPeriodEnd
      ? Math.ceil((new Date(r.currentPeriodEnd).getTime() - now) / 86400000)
      : null;

    let method: string;
    if (manualMethodByRestaurant.has(r.id)) {
      method = manualMethodByRestaurant.get(r.id)!;
    } else if (r.flowPlanId || r.flowSubscriptionId) {
      method = "Flow";
    } else if (r.mpPayerEmail) {
      method = "MercadoPago";
    } else {
      method = "—";
    }

    return {
      id: r.id,
      name: r.name,
      plan: r.plan,
      subscriptionStatus: r.subscriptionStatus,
      currentPeriodEnd: r.currentPeriodEnd?.toISOString() ?? null,
      lastPaymentAt: r.lastPaymentAt?.toISOString() ?? null,
      trialEndsAt: r.trialEndsAt?.toISOString() ?? null,
      billingExempt: r.billingExempt,
      daysLeft,
      netAmount: net,
      grossAmount: gross,
      method,
    };
  });

  const totalMonthlyRevenue = rows
    .filter(r => r.subscriptionStatus === "ACTIVE" && !r.billingExempt)
    .reduce((sum, r) => sum + r.netAmount, 0);

  return NextResponse.json({ restaurants: rows, totalMonthlyRevenue });
}
