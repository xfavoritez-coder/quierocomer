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
  const { lang, description, regenerate } = body;

  if (!lang) {
    return NextResponse.json({ error: "lang requerido" }, { status: 400 });
  }

  const dish = await prisma.dish.findUnique({ where: { id }, select: { restaurantId: true } });
  if (!dish) return NextResponse.json({ error: "Plato no encontrado" }, { status: 404 });
  await assertOwnsRestaurant(req, dish.restaurantId);

  if (regenerate) {
    // Mark as non-manual and trigger re-translation
    await prisma.dishTranslation.updateMany({
      where: { dishId: id, lang },
      data: { isManual: false },
    });
    // Trigger background re-translation
    try {
      const { translateDish } = await import("@/lib/ai/translateContent");
      translateDish(id).catch(() => {});
    } catch {}
    return NextResponse.json({ ok: true, regenerating: true });
  }

  if (!description) {
    return NextResponse.json({ error: "description requerido" }, { status: 400 });
  }

  const translation = await prisma.dishTranslation.upsert({
    where: { dishId_lang: { dishId: id, lang } },
    create: { dishId: id, lang, description, isManual: true },
    update: { description, isManual: true },
  });

  return NextResponse.json(translation);
}
