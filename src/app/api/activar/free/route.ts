import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import { sendAdminEmail, adminNewActivationEmailHtml } from "@/lib/email/sendAdminEmail";
import { activationWelcomeEmailHtml } from "@/app/api/preview-email/activation/route";

/**
 * POST /api/activar/free
 * Body: { restaurantId }
 *
 * Activa un restaurant demo en plan gratis. Sin pago, sin traducción.
 */
export async function POST(req: NextRequest) {
  let body: { restaurantId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  const { restaurantId } = body;
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, isDemo: true, slug: true, name: true, owner: { select: { email: true, name: true } } },
  });

  if (!restaurant || !restaurant.isDemo) {
    return NextResponse.json({ error: "No encontrado o ya activado" }, { status: 404 });
  }

  // All plans from /planes get 14 days of premium trial
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);

  await prisma.$transaction([
    prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        isDemo: false,
        plan: "PREMIUM",
        subscriptionStatus: "TRIALING",
        trialEndsAt,
        weeklyEmailEnabled: true,
      },
    }),
    // Solo borrar fotos Unsplash (tienen photoCredits), NO las del sitio del restaurante
    prisma.dish.updateMany({
      where: { restaurantId, isPhotoReferential: true },
      data: { photos: [], isPhotoReferential: false, photoCredits: [] },
    }),
    // Borrar sessions demo (cascade borra DishImpressions)
    prisma.session.deleteMany({ where: { restaurantId } }),
  ]);

  // Fire-and-forget: emails de notificación
  const ownerEmail = restaurant.owner?.email;
  const ownerName = restaurant.owner?.name || ownerEmail?.split("@")[0] || "Hola";
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";
  const panelLink = `${baseUrl}/api/panel/demo-auth?slug=${restaurant.slug}`;
  const qrLink = `${baseUrl}/qr/${restaurant.slug}`;

  // Send welcome email to owner with credentials
  if (ownerEmail) {
    const { activationWelcomeEmailHtml } = await import("@/app/api/preview-email/activation/route");
    const password = `${restaurant.slug}2026`;
    sendAdminEmail({
      to: ownerEmail,
      subject: `🔑 Datos de acceso a tu panel — ${restaurant.name}`,
      html: activationWelcomeEmailHtml({
        ownerName,
        restaurantName: restaurant.name,
        panelLink,
        qrLink,
        credentials: { email: ownerEmail, password },
        planLabel: "Premium (14 dias gratis)",
      }),
      purpose: "activation_welcome",
    }).catch((err) => console.error("[activar/free] Email owner falló:", err));
  }

  sendAdminEmail({
    to: "favoritez@gmail.com",
    subject: `Nuevo cliente: ${restaurant.name} activó Gratis (14 dias premium)`,
    html: adminNewActivationEmailHtml(restaurant.name, "Gratis + 14 dias Premium", "$0 (trial)", ownerEmail || "sin email", restaurant.slug || ""),
    purpose: "admin_new_activation",
  }).catch((err) => console.error("[activar/free] Email admin falló:", err));

  // Track activation in Lead funnel
  if (restaurant.slug) {
    prisma.lead.updateMany({
      where: { generatedSlug: restaurant.slug, activatedAt: null },
      data: { activatedAt: new Date(), activated: true },
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, plan: "FREE", trialEndsAt: trialEndsAt.toISOString() });
}
