import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, requireRestaurantForOwner, authErrorResponse } from "@/lib/adminAuth";

// GET /api/loyalty/dish-photos?restaurantId=xxx
// Devuelve las fotos de los platos de la carta, para elegir una como fondo de la tarjeta.
export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const restaurantId = req.nextUrl.searchParams.get("restaurantId");
    if (!restaurantId) return NextResponse.json({ error: "restaurantId requerido" }, { status: 400 });
    await requireRestaurantForOwner(req, restaurantId);

    const dishes = await prisma.dish.findMany({
      where: { restaurantId, isPhotoReferential: false, photos: { isEmpty: false } },
      select: { name: true, photos: true },
      take: 120,
    });

    // Una entrada por foto (la primera de cada plato), con el nombre del plato.
    const photos: { name: string; url: string }[] = [];
    for (const d of dishes) {
      const url = d.photos.find((p) => typeof p === "string" && p.startsWith("http"));
      if (url) photos.push({ name: d.name, url });
      if (photos.length >= 60) break;
    }

    return NextResponse.json({ photos });
  } catch (e: any) {
    if (e.status) return authErrorResponse(e);
    console.error("[Loyalty dish-photos GET]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
