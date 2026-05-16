import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { restaurantId, plan } = await req.json();
  if (!restaurantId) return NextResponse.json({ error: "missing restaurantId" }, { status: 400 });

  const validPlans = ["FREE", "GOLD", "PREMIUM"] as const;
  const selectedPlan = validPlans.includes(plan) ? plan : "FREE";

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, isDemo: true, subscriptionStatus: true },
  });
  if (!restaurant || !restaurant.isDemo) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (selectedPlan === "FREE") {
    // Activate as free — just remove demo flag
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { isDemo: false, plan: "FREE" },
    });
    return NextResponse.json({ ok: true, plan: "FREE" });
  }

  // Gold or Premium — activate trial
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + (selectedPlan === "PREMIUM" ? 30 : 7));

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      plan: selectedPlan,
      subscriptionStatus: "TRIALING",
      trialEndsAt,
      isDemo: false,
    },
  });

  return NextResponse.json({ ok: true, plan: selectedPlan, trialEndsAt: trialEndsAt.toISOString() });
}
