import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, assertOwnsRestaurant } from "@/lib/adminAuth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const { id } = await params;
  const dish = await prisma.dish.findUnique({ where: { id }, select: { restaurantId: true } });
  if (!dish) return NextResponse.json({ error: "Plato no encontrado" }, { status: 404 });
  await assertOwnsRestaurant(req, dish.restaurantId);

  const translations = await prisma.dishTranslation.findMany({ where: { dishId: id } });
  return NextResponse.json(translations);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const { id } = await params;
  const body = await req.json();
  const { lang, description } = body;

  if (!lang || !description) {
    return NextResponse.json({ error: "lang y description requeridos" }, { status: 400 });
  }

  const dish = await prisma.dish.findUnique({ where: { id }, select: { restaurantId: true } });
  if (!dish) return NextResponse.json({ error: "Plato no encontrado" }, { status: 404 });
  await assertOwnsRestaurant(req, dish.restaurantId);

  const translation = await prisma.dishTranslation.upsert({
    where: { dishId_lang: { dishId: id, lang } },
    create: { dishId: id, lang, description, isManual: true },
    update: { description, isManual: true },
  });

  return NextResponse.json(translation);
}
