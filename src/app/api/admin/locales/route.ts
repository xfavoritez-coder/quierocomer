import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  try {
    const restaurants = await prisma.restaurant.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, slug: true, name: true, description: true,
        logoUrl: true, bannerUrl: true, phone: true, address: true,
        cartaTheme: true, defaultView: true, isActive: true, ownerId: true,
        createdAt: true, updatedAt: true,
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { dishes: true, categories: true, statEvents: true, sessions: true } },
      },
    });
    return NextResponse.json(restaurants);
  } catch (error) {
    console.error("[Admin locales]", error);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  try {
    const { name, slug, description, phone, address, logoUrl, bannerUrl, cartaTheme, ownerId } = await req.json();
    if (!name || !slug) return NextResponse.json({ error: "Nombre y slug requeridos" }, { status: 400 });

    const existing = await prisma.restaurant.findUnique({ where: { slug } });
    if (existing) return NextResponse.json({ error: "Slug ya existe" }, { status: 400 });

    const restaurant = await prisma.restaurant.create({
      data: {
        name, slug, description: description || null,
        phone: phone || null, address: address || null,
        logoUrl: logoUrl || null, bannerUrl: bannerUrl || null,
        cartaTheme: cartaTheme || "PREMIUM",
        ownerId: ownerId || null,
      },
      select: { id: true, name: true, slug: true, createdAt: true },
    });
    return NextResponse.json(restaurant);
  } catch (error) {
    console.error("[Admin locales POST]", error);
    return NextResponse.json({ error: "Error al crear" }, { status: 500 });
  }
}
