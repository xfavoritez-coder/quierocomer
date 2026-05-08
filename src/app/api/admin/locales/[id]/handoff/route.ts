import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";
import { sendAdminEmail, handoffOwnerEmailHtml } from "@/lib/email/sendAdminEmail";
import { TRIAL_DAYS } from "@/lib/billing/plans-config";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";

/**
 * POST /api/admin/locales/[id]/handoff
 *
 * Entrega un local al dueño:
 * 1. Crea (o linkea) un RestaurantOwner con email
 * 2. Genera contraseña amigable y obliga cambio en primer login
 * 3. Marca el restaurant como TRIALING con trialEndsAt = +TRIAL_DAYS dias
 * 4. Envia email al dueño con credenciales + info del trial
 *
 * Solo superadmin.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const { id: restaurantId } = await params;

  let body: { email?: string; name?: string; whatsapp?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body invalido" }, { status: 400 }); }

  const email = body.email?.trim().toLowerCase();
  const name = body.name?.trim();
  const whatsapp = body.whatsapp?.trim() || null;

  if (!email || !name) {
    return NextResponse.json({ error: "email y name son requeridos" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Email invalido" }, { status: 400 });
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, name: true, slug: true, plan: true, subscriptionStatus: true, ownerId: true, billingExempt: true },
  });
  if (!restaurant) return NextResponse.json({ error: "Local no encontrado" }, { status: 404 });

  if (restaurant.plan === "FREE") {
    return NextResponse.json({ error: "El local esta en FREE — cambialo a GOLD o PREMIUM antes de entregar" }, { status: 400 });
  }

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

  // Activar trial
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      subscriptionStatus: "TRIALING",
      trialEndsAt,
    },
  });

  // Enviar email de bienvenida con credenciales + info del trial
  const planLabel = restaurant.plan === "PREMIUM" ? "Premium" : "Gold";
  const qrLink = `${BASE_URL}/qr/${restaurant.slug}`;
  const panelLink = `${BASE_URL}/panel`;

  let emailSent = false;
  let emailError: string | null = null;
  try {
    await sendAdminEmail({
      to: email,
      subject: `${name}, tu plan ${planLabel} está activo · ${TRIAL_DAYS} días gratis`,
      html: handoffOwnerEmailHtml(name, email, password, qrLink, panelLink, planLabel, TRIAL_DAYS),
      purpose: "welcome",
    });
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
    trialEndsAt: trialEndsAt.toISOString(),
    plan: restaurant.plan,
    emailSent,
    emailError,
  });
}
