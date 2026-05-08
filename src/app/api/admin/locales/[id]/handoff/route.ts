import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";
import { sendAdminEmail, handoffOwnerEmailHtml, handoffFreeEmailHtml } from "@/lib/email/sendAdminEmail";
import { TRIAL_DAYS } from "@/lib/billing/plans-config";
import type { RestaurantPlan } from "@prisma/client";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";

/**
 * POST /api/admin/locales/[id]/handoff
 *
 * Entrega un local al dueño. El plan a entregar viene en el body
 * (puede diferir del plan actual del local — ej: vendedor lo creo en
 * PREMIUM para la demo y el dueño escogio GOLD).
 *
 * Comportamiento por plan:
 * - GOLD / PREMIUM: marca el local en ese plan + TRIALING con trialEndsAt
 *   = +TRIAL_DAYS dias. Email con info del trial.
 * - FREE: marca el local en FREE + subscriptionStatus NONE. Email de
 *   bienvenida simple sin info de trial.
 *
 * En todos los casos: crea (o linkea) RestaurantOwner, genera password
 * amigable, fuerza cambio en primer login.
 *
 * Solo superadmin.
 */

const VALID_PLANS = ["FREE", "GOLD", "PREMIUM"] as const;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const { id: restaurantId } = await params;

  let body: { email?: string; name?: string; whatsapp?: string; plan?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body invalido" }, { status: 400 }); }

  const email = body.email?.trim().toLowerCase();
  const name = body.name?.trim();
  const whatsapp = body.whatsapp?.trim() || null;
  const plan = body.plan?.toUpperCase() as RestaurantPlan | undefined;

  if (!email || !name) {
    return NextResponse.json({ error: "email y name son requeridos" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Email invalido" }, { status: 400 });
  }
  if (!plan || !VALID_PLANS.includes(plan as any)) {
    return NextResponse.json({ error: "plan debe ser FREE, GOLD o PREMIUM" }, { status: 400 });
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, name: true, slug: true, plan: true, qrToken: true, subscriptionStatus: true, ownerId: true, billingExempt: true },
  });
  if (!restaurant) return NextResponse.json({ error: "Local no encontrado" }, { status: 404 });

  // Password amigable: nombredellocal + año actual
  const cleanName = restaurant.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
  const year = new Date().getFullYear();
  const password = `${cleanName}${year}`;
  const passwordHash = await bcrypt.hash(password, 10);

  // Crear o linkear owner
  const existing = await prisma.restaurantOwner.findUnique({ where: { email } });

  let owner;
  if (existing) {
    owner = await prisma.restaurantOwner.update({
      where: { id: existing.id },
      data: {
        restaurants: { connect: { id: restaurantId } },
        ...(whatsapp && !existing.whatsapp ? { whatsapp } : {}),
      },
    });
  } else {
    owner = await prisma.restaurantOwner.create({
      data: {
        email,
        passwordHash,
        name,
        whatsapp,
        status: "ACTIVE",
        mustChangePassword: true,
        restaurants: { connect: { id: restaurantId } },
      },
    });
  }

  // Activar plan + trial segun lo escogido
  const isPaidPlan = plan === "GOLD" || plan === "PREMIUM";
  const trialEndsAt = isPaidPlan ? new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000) : null;

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      plan,
      subscriptionStatus: isPaidPlan ? "TRIALING" : "NONE",
      trialEndsAt,
      trialReminderSentAt: null, // reset por si el local viene de un ciclo previo
    },
  });

  // Enviar email
  const planLabel = plan === "PREMIUM" ? "Premium" : plan === "GOLD" ? "Gold" : "Gratis";
  const qrLink = `${BASE_URL}/qr/${restaurant.slug}${restaurant.qrToken ? `?t=${restaurant.qrToken}` : ""}`;
  const panelLink = `${BASE_URL}/panel`;

  let emailSent = false;
  let emailError: string | null = null;
  try {
    if (isPaidPlan) {
      await sendAdminEmail({
        to: email,
        subject: `${name}, tu plan ${planLabel} está activo · ${TRIAL_DAYS} días gratis`,
        html: handoffOwnerEmailHtml(name, email, password, qrLink, panelLink, planLabel, TRIAL_DAYS),
        purpose: "welcome",
      });
    } else {
      await sendAdminEmail({
        to: email,
        subject: `${name}, tu carta de ${restaurant.name} ya está lista`,
        html: handoffFreeEmailHtml(name, email, password, qrLink, panelLink, restaurant.name),
        purpose: "welcome",
      });
    }
    emailSent = true;
  } catch (e: any) {
    emailError = e?.message || "Error al enviar email";
    console.error("[handoff] email error:", emailError);
  }

  return NextResponse.json({
    ok: true,
    ownerId: owner.id,
    isNewOwner: !existing,
    passwordGenerated: existing ? null : password,
    plan,
    trialEndsAt: trialEndsAt?.toISOString() || null,
    isPaidPlan,
    emailSent,
    emailError,
  });
}
