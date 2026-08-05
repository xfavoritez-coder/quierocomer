import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth } from "@/lib/adminAuth";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const { storeName, ownerName, email, whatsapp, password } = await req.json();
  if (!storeName?.trim() || !ownerName?.trim() || !email?.trim()) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  // Generate slug
  let slug = storeName.trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const existing = await prisma.restaurant.findUnique({ where: { slug } });
  if (existing) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const finalPassword = password?.trim() || `${slug.replace(/-/g, "")}2026`;
  const passwordHash = await bcrypt.hash(finalPassword, 10);

  // Create restaurant
  const restaurant = await prisma.restaurant.create({
    data: {
      name: storeName.trim(),
      slug,
      profileType: "STORE",
      plan: "PREMIUM",
      subscriptionStatus: "TRIALING",
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isActive: true,
      isDemo: false,
      cartaTheme: "PREMIUM",
    },
  });

  // Create loyalty program
  await prisma.loyaltyProgram.create({
    data: {
      restaurantId: restaurant.id,
      name: `Tarjeta ${storeName.trim()}`,
      active: true,
      stampGoal: 8,
      stampIcon: "⭐",
      rewards: [{ stamp: 8, reward: "Premio especial" }],
    },
  });

  // Create or link owner
  let owner = await prisma.restaurantOwner.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (owner) {
    owner = await prisma.restaurantOwner.update({
      where: { id: owner.id },
      data: {
        restaurants: { connect: { id: restaurant.id } },
        ...(whatsapp && !owner.whatsapp ? { whatsapp: whatsapp.trim() } : {}),
      },
    });
  } else {
    owner = await prisma.restaurantOwner.create({
      data: {
        email: email.trim().toLowerCase(),
        passwordHash,
        name: ownerName.trim(),
        whatsapp: whatsapp?.trim() || null,
        status: "ACTIVE",
        mustChangePassword: false,
        emailVerificado: true,
        restaurants: { connect: { id: restaurant.id } },
      },
    });
  }

  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: { ownerId: owner.id },
  });

  return NextResponse.json({ ok: true, slug, restaurantId: restaurant.id, ownerId: owner.id, password: finalPassword });
}
