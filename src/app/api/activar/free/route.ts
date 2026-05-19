import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
    select: { id: true, isDemo: true, slug: true },
  });

  if (!restaurant || !restaurant.isDemo) {
    return NextResponse.json({ error: "No encontrado o ya activado" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        isDemo: false,
        plan: "FREE",
        weeklyEmailEnabled: true,
      },
    }),
    // Limpiar fotos Unsplash referenciales
    prisma.dish.updateMany({
      where: { restaurantId, isPhotoReferential: true },
      data: { photos: [], isPhotoReferential: false, photoCredits: [] },
    }),
    // Borrar sessions demo (cascade borra DishImpressions)
    prisma.session.deleteMany({ where: { restaurantId } }),
  ]);

  return NextResponse.json({ ok: true, plan: "FREE" });
}
