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

  // Backfill Unsplash photos for dishes without photos (fire-and-forget)
  (async () => {
    try {
      const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;
      if (!UNSPLASH_KEY) return;
      const { searchUnsplashPhoto, triggerUnsplashDownload } = await import("@/lib/unsplash");
      const missing = await prisma.dish.findMany({
        where: { restaurantId, isActive: true, photos: { equals: [] } },
        select: { id: true, name: true },
      });
      if (missing.length === 0) return;
      console.log(`[Activar] Backfilling ${missing.length} Unsplash photos for ${restaurantId}`);
      for (let i = 0; i < missing.length; i += 10) {
        const batch = missing.slice(i, i + 10);
        await Promise.allSettled(batch.map(async (d) => {
          const photo = await searchUnsplashPhoto(`${d.name} food dish`);
          if (photo) {
            await prisma.dish.update({
              where: { id: d.id },
              data: { photos: [photo.rawUrl], isPhotoReferential: true, photoCredits: [{ photographer: photo.photographer, profileUrl: photo.profileUrl, unsplashId: photo.unsplashId }] },
            });
            triggerUnsplashDownload(photo.downloadLocation).catch(() => {});
          }
        }));
      }
      console.log(`[Activar] Unsplash backfill done for ${restaurantId}`);
    } catch (err) {
      console.error(`[Activar] Unsplash backfill failed for ${restaurantId}:`, err);
    }
  })();

  return NextResponse.json({
    ok: true,
    plan: selectedPlan,
    ...(selectedPlan !== "FREE" && { trialEndsAt: new Date(Date.now() + (selectedPlan === "PREMIUM" ? 30 : 7) * 86400000).toISOString() }),
  });
}
