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
    },
    orderBy: { currentPeriodEnd: "desc" },
  });

  const now = Date.now();

  const rows = restaurants.map(r => {
    const net = r.customPlanPriceNet ?? planNetAmount(r.plan as any);
    const iva = Math.round(net * 0.19);
    const gross = net + iva;
    const daysLeft = r.currentPeriodEnd
      ? Math.ceil((new Date(r.currentPeriodEnd).getTime() - now) / 86400000)
      : null;
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
      method: r.mpPayerEmail ? "Flow/MP" : "Manual",
    };
  });

  const totalMonthlyRevenue = rows
    .filter(r => r.subscriptionStatus === "ACTIVE" && !r.billingExempt)
    .reduce((sum, r) => sum + r.netAmount, 0);

  return NextResponse.json({ restaurants: rows, totalMonthlyRevenue });
}
