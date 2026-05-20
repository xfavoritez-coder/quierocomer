import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAdminEmail, freeActivatedEmailHtml, adminNewActivationEmailHtml } from "@/lib/email/sendAdminEmail";

export async function POST(req: NextRequest) {
  const { restaurantId, plan } = await req.json();
  if (!restaurantId) return NextResponse.json({ error: "missing restaurantId" }, { status: 400 });

  const validPlans = ["FREE", "GOLD", "PREMIUM"] as const;
  const selectedPlan = validPlans.includes(plan) ? plan : "FREE";

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, isDemo: true, slug: true, name: true, subscriptionStatus: true, needsTranslation: true, owner: { select: { email: true, name: true } } },
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
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

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

  // Send activation email with credentials
  const ownerEmail = restaurant.owner?.email;
  const ownerName = restaurant.owner?.name || ownerEmail?.split("@")[0] || "Hola";
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";
  const panelLink = `${baseUrl}/api/panel/demo-auth?slug=${restaurant.slug}`;
  const qrLink = `${baseUrl}/qr/${restaurant.slug}`;
  const planLabel = selectedPlan === "PREMIUM" ? "Premium (14 días gratis)" : selectedPlan === "GOLD" ? "Gold (14 días gratis)" : "Gratis";

  if (ownerEmail) {
    sendAdminEmail({
      to: ownerEmail,
      subject: `${restaurant.name} · Tu carta está activa`,
      html: freeActivatedEmailHtml(ownerName, restaurant.name!, panelLink, qrLink, { email: ownerEmail, password: `${restaurant.slug}2026` }),
      purpose: "trial_activated",
    }).catch(() => {});
  }
  sendAdminEmail({
    to: "favoritez@gmail.com",
    subject: `Nuevo cliente: ${restaurant.name} activó ${planLabel}`,
    html: adminNewActivationEmailHtml(restaurant.name!, planLabel, "$0 (trial)", ownerEmail || "sin email", restaurant.slug || ""),
    purpose: "admin_new_activation",
  }).catch(() => {});

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
    ...(selectedPlan !== "FREE" && { trialEndsAt: new Date(Date.now() + 14 * 86400000).toISOString() }),
  });
}
