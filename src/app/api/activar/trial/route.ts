import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sendAdminEmail, adminNewActivationEmailHtml } from "@/lib/email/sendAdminEmail";
import { activationWelcomeEmailHtml } from "@/app/api/preview-email/activation/route";

export async function POST(req: NextRequest) {
  const { restaurantId, plan, ownerName: newOwnerName, email: newEmail, whatsapp: newWhatsapp } = await req.json();
  if (!restaurantId) return NextResponse.json({ error: "missing restaurantId" }, { status: 400 });

  const validPlans = ["FREE", "SILVER", "GOLD", "PREMIUM"] as const;
  const selectedPlan = validPlans.includes(plan) ? plan : "FREE";

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, isDemo: true, slug: true, name: true, subscriptionStatus: true, needsTranslation: true, owner: { select: { email: true, name: true } } },
  });
  if (!restaurant || !restaurant.isDemo) return NextResponse.json({ error: "not found or already activated" }, { status: 404 });

  // Block activation if email not verified
  const ownerCheck = await prisma.restaurantOwner.findFirst({
    where: { restaurants: { some: { id: restaurantId } } },
    select: { id: true, emailVerificado: true },
  });
  if (ownerCheck && !ownerCheck.emailVerificado) {
    return NextResponse.json({ error: "email_not_verified", message: "Debes verificar tu correo antes de activar tu plan." }, { status: 403 });
  }

  // Guard: atomically set isDemo=false to prevent double activation
  const { count } = await prisma.restaurant.updateMany({
    where: { id: restaurantId, isDemo: true },
    data: { isDemo: false },
  });
  if (count === 0) return NextResponse.json({ error: "already activated" }, { status: 409 });

  // Update owner data if provided (from inline form)
  if (newOwnerName || newEmail || newWhatsapp) {
    const owner = await prisma.restaurantOwner.findFirst({
      where: { restaurants: { some: { id: restaurantId } } },
      select: { id: true, email: true },
    });
    if (owner) {
      const ownerUpdate: Record<string, any> = {};
      if (newOwnerName?.trim()) ownerUpdate.name = newOwnerName.trim();
      if (newEmail?.trim()) {
        const cleanEmail = newEmail.trim().toLowerCase();
        ownerUpdate.email = cleanEmail;
        // If email changed, regenerate password hash so credentials match
        if (cleanEmail !== owner.email) {
          ownerUpdate.passwordHash = await bcrypt.hash(`${restaurant.slug}2026`, 10);
        }
      }
      if (newWhatsapp?.trim()) ownerUpdate.whatsapp = newWhatsapp.trim();
      if (Object.keys(ownerUpdate).length > 0) {
        await prisma.restaurantOwner.update({
          where: { id: owner.id },
          data: ownerUpdate,
        });
      }
    }
  }

  if (selectedPlan === "FREE") {
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { plan: "FREE", weeklyEmailEnabled: true },
    });
  } else {
    // Gold or Premium — activate trial
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 7);

    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        plan: selectedPlan,
        subscriptionStatus: "TRIALING",
        trialEndsAt,
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

  // Re-fetch owner data in case it was updated
  const freshOwner = await prisma.restaurantOwner.findFirst({
    where: { restaurants: { some: { id: restaurantId } } },
    select: { email: true, name: true },
  });
  const ownerEmail = freshOwner?.email || restaurant.owner?.email;
  const ownerName = freshOwner?.name || restaurant.owner?.name || ownerEmail?.split("@")[0] || "Hola";
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.com";
  const panelLink = `${baseUrl}/panel`;
  const qrLink = `${baseUrl}/qr/${restaurant.slug}`;
  const planLabel = selectedPlan === "FREE" ? "Gratis" : `${selectedPlan.charAt(0) + selectedPlan.slice(1).toLowerCase()} (7 dias de Premium gratis)`;

  // Send welcome email to owner with credentials
  if (ownerEmail) {
    const password = `${restaurant.slug}2026`;
    sendAdminEmail({
      to: ownerEmail,
      subject: `🔑 Datos de acceso a tu panel — ${restaurant.name}`,
      html: activationWelcomeEmailHtml({
        ownerName,
        restaurantName: restaurant.name!,
        panelLink,
        qrLink,
        credentials: { email: ownerEmail, password },
        planLabel,
      }),
      purpose: "activation_welcome",
    }).catch((err) => console.error("[Activar/trial] Email owner falló:", err));
  }

  sendAdminEmail({
    to: "favoritez@gmail.com",
    subject: `Nuevo cliente: ${restaurant.name} activó ${planLabel}`,
    html: adminNewActivationEmailHtml(restaurant.name!, planLabel, "$0 (trial)", ownerEmail || "sin email", restaurant.slug || ""),
    purpose: "admin_new_activation",
  }).catch(() => {});

  // Solo borrar fotos Unsplash (tienen photoCredits), NO las del sitio del restaurante
  prisma.dish.updateMany({
    where: { restaurantId, isPhotoReferential: true },
    data: { photos: [], isPhotoReferential: false, photoCredits: [] },
  }).then((r) => {
    if (r.count > 0) console.log(`[Activar] Cleared ${r.count} Unsplash referential photos for ${restaurantId}`);
  }).catch(() => {});

  // Track activation in Lead funnel
  if (restaurant.slug) {
    prisma.lead.updateMany({
      where: { generatedSlug: restaurant.slug, activatedAt: null },
      data: { activatedAt: new Date(), activated: true },
    }).catch(() => {});
  }

  // Invalidate carta cache so it immediately reflects isDemo=false
  revalidateTag(`qr-restaurant-${restaurant.slug}`, "minutes");

  return NextResponse.json({
    ok: true,
    plan: selectedPlan,
    ...(selectedPlan !== "FREE" && { trialEndsAt: new Date(Date.now() + 7 * 86400000).toISOString() }),
  });
}
