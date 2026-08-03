import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LOYALTY_TRIAL_DAYS } from "@/lib/billing/plans-central";
import { sendWhatsApp, buildLoyaltyTrialMessage } from "@/lib/whatsapp";
import { sendAdminEmail } from "@/lib/email/sendAdminEmail";
import { activationWelcomeEmailHtml } from "@/app/api/preview-email/activation/route";
import bcrypt from "bcryptjs";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.com";

/**
 * POST /api/billing/loyalty/start-trial
 * Activa 7 días de prueba del módulo Loyalty. Sin pago.
 * Envía email con credenciales + WhatsApp con link de acceso directo.
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
    include: { restaurants: { where: { id: restaurantId }, take: 1 } },
  });
  if (!owner || owner.status !== "ACTIVE") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const restaurant = owner.restaurants[0];
  if (!restaurant) return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });

  if (restaurant.loyaltyStatus === "ACTIVE") {
    return NextResponse.json({ error: "Ya tienes Loyalty activo" }, { status: 409 });
  }
  if (restaurant.loyaltyStatus === "TRIALING") {
    return NextResponse.json({ error: "Ya tienes un periodo de prueba activo" }, { status: 409 });
  }

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + LOYALTY_TRIAL_DAYS);

  // Generar contraseña temporal
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let tempPassword = "";
  for (let i = 0; i < 10; i++) tempPassword += chars[Math.floor(Math.random() * chars.length)];
  const hash = await bcrypt.hash(tempPassword, 10);

  // Activar trial + actualizar contraseña + crear short link — todo en una transacción
  const [, , shortLink] = await prisma.$transaction([
    prisma.restaurant.update({
      where: { id: restaurantId },
      data: { loyaltyStatus: "TRIALING", loyaltyTrialEndsAt: trialEndsAt },
    }),
    prisma.restaurantOwner.update({
      where: { id: owner.id },
      data: { passwordHash: hash, mustChangePassword: true },
    }),
    prisma.panelShortLink.create({
      data: { ownerId: owner.id },
    }),
  ]);

  const firstName = owner.name.split(" ")[0];
  const panelLink = `${BASE_URL}/panel`;
  const qrLink = `${BASE_URL}/qr/${restaurant.slug}`;

  // Email con credenciales (fire-and-forget)
  sendAdminEmail({
    to: owner.email,
    subject: `${firstName}, tu prueba gratuita de Fidelización está activa`,
    html: activationWelcomeEmailHtml({
      ownerName: firstName,
      restaurantName: restaurant.name,
      panelLink,
      qrLink,
      credentials: { email: owner.email, password: tempPassword },
    }),
    purpose: "loyalty_trial_welcome",
  }).catch((e) => console.error("[LoyaltyTrial Email]", e));

  // WhatsApp con link corto (fire-and-forget)
  if (owner.whatsapp) {
    const msg = buildLoyaltyTrialMessage({
      ownerName: owner.name,
      restaurantName: restaurant.name,
      email: owner.email,
    });
    sendWhatsApp({ to: owner.whatsapp, ...msg }).catch((e) =>
      console.error("[LoyaltyTrial WA]", e),
    );
  }

  return NextResponse.json({ ok: true, loyaltyTrialEndsAt: trialEndsAt.toISOString() });
}
