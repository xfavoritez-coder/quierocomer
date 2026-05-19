import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { restaurantId, plan } = await req.json();
  if (!restaurantId) return NextResponse.json({ error: "missing restaurantId" }, { status: 400 });

  const validPlans = ["FREE", "GOLD", "PREMIUM"] as const;
  const selectedPlan = validPlans.includes(plan) ? plan : "FREE";

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, isDemo: true, subscriptionStatus: true, needsTranslation: true },
  });
  if (!restaurant || !restaurant.isDemo) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (selectedPlan === "FREE") {
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { isDemo: false, plan: "FREE", weeklyEmailEnabled: true },
    });
  } else {
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
        weeklyEmailEnabled: true,
      },
    });
  }

  // On activation, backfill translations + Unsplash photos (fire-and-forget)
  if (restaurant.needsTranslation) {
    import("@/lib/ai/translateContent").then(({ translateAllForRestaurant }) => {
      translateAllForRestaurant(restaurantId)
        .then(() => prisma.restaurant.update({ where: { id: restaurantId }, data: { needsTranslation: false } }))
        .then(() => console.log(`[Activar] Full translation completed for ${restaurantId}`))
        .catch((err) => console.error(`[Activar] Translation backfill failed for ${restaurantId}:`, err));
    });
  }

  // Remove Unsplash referential photos — owner should upload their own real photos
  prisma.dish.updateMany({
    where: { restaurantId, isPhotoReferential: true },
    data: { photos: [], isPhotoReferential: false, photoCredits: [] },
  }).then((r) => {
    if (r.count > 0) console.log(`[Activar] Cleared ${r.count} Unsplash referential photos for ${restaurantId}`);
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    plan: selectedPlan,
    ...(selectedPlan !== "FREE" && { trialEndsAt: new Date(Date.now() + (selectedPlan === "PREMIUM" ? 30 : 7) * 86400000).toISOString() }),
  });
}
