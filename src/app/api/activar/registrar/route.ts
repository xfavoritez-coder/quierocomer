import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import bcrypt from "bcryptjs";

/**
 * POST /api/activar/registrar
 * Body: { localName, ownerName, email }
 *
 * Crea un restaurant vacío + owner para activación directa desde /planes.
 * El restaurant se crea como demo para que pase por el flujo de /activar/[slug].
 */
export async function POST(req: NextRequest) {
  let body: { localName?: string; ownerName?: string; email?: string; whatsapp?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  const { localName, ownerName, email, whatsapp } = body;
  if (!localName?.trim() || !email?.trim() || !email.includes("@")) {
    return NextResponse.json({ error: "Completa nombre del local y email" }, { status: 400 });
  }

  // Generar slug
  let slug = localName.trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!slug) slug = "mi-local";
  const existing = await prisma.restaurant.findUnique({ where: { slug } });
  if (existing) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const qrToken = crypto.randomUUID().replace(/-/g, "").slice(0, 12);

  // Crear o encontrar owner
  let owner = await prisma.restaurantOwner.findFirst({ where: { email: email.trim().toLowerCase() } });
  if (!owner) {
    const passwordHash = await bcrypt.hash(`${slug}2026`, 10);
    owner = await prisma.restaurantOwner.create({
      data: {
        name: ownerName?.trim() || localName.trim(),
        email: email.trim().toLowerCase(),
        passwordHash,
        role: "OWNER",
        whatsapp: whatsapp?.trim() || undefined,
      },
    });
  }

  // Crear restaurant vacío (demo, sin platos ni categorías)
  const restaurant = await prisma.restaurant.create({
    data: {
      name: localName.trim(),
      slug,
      cartaTheme: "PREMIUM",
      cartaColorMode: "DARK",
      defaultView: "impact",
      enabledLangs: ["es"],
      isActive: true,
      isDemo: true,
      weeklyEmailEnabled: true,
      qrToken,
      qrActivatedAt: new Date(),
      plan: "PREMIUM",
      ownerId: owner.id,
    },
  });

  return NextResponse.json({ ok: true, slug: restaurant.slug, plan: "PREMIUM" });
}
