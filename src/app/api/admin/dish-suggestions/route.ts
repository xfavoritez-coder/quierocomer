import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, requireRestaurantForOwner, authErrorResponse } from "@/lib/adminAuth";

/** GET — list suggestions for a dish */
export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const dishId = req.nextUrl.searchParams.get("dishId");
    if (!dishId) return NextResponse.json({ error: "dishId requerido" }, { status: 400 });

    const dish = await prisma.dish.findUnique({ where: { id: dishId }, select: { restaurantId: true } });
    if (!dish) return NextResponse.json({ error: "Plato no encontrado" }, { status: 404 });
    await requireRestaurantForOwner(req, dish.restaurantId);

    const suggestions = await prisma.dishSuggestion.findMany({
      where: { dishId },
      include: { suggestedDish: { select: { id: true, name: true, photos: true, price: true } } },
    });

    return NextResponse.json({ suggestions: suggestions.map(s => s.suggestedDish) });
  } catch (e: any) {
    if (e.status === 400 || e.status === 403) return authErrorResponse(e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

/** POST — add suggestion */
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { dishId, suggestedDishId } = await req.json();
    if (!dishId || !suggestedDishId) return NextResponse.json({ error: "dishId y suggestedDishId requeridos" }, { status: 400 });

    const dish = await prisma.dish.findUnique({ where: { id: dishId }, select: { restaurantId: true } });
    if (!dish) return NextResponse.json({ error: "Plato no encontrado" }, { status: 404 });
    await requireRestaurantForOwner(req, dish.restaurantId);

    // Max 5 suggestions per dish
    const count = await prisma.dishSuggestion.count({ where: { dishId } });
    if (count >= 5) return NextResponse.json({ error: "Máximo 5 sugerencias por plato" }, { status: 400 });

    await prisma.dishSuggestion.create({
      data: { dishId, suggestedDishId, restaurantId: dish.restaurantId },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.status === 400 || e.status === 403) return authErrorResponse(e);
    if (e?.code === "P2002") return NextResponse.json({ error: "Ya existe esa sugerencia" }, { status: 409 });
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

/** DELETE — remove suggestion */
export async function DELETE(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { dishId, suggestedDishId } = await req.json();
    if (!dishId || !suggestedDishId) return NextResponse.json({ error: "Campos requeridos" }, { status: 400 });

    const dish = await prisma.dish.findUnique({ where: { id: dishId }, select: { restaurantId: true } });
    if (!dish) return NextResponse.json({ error: "Plato no encontrado" }, { status: 404 });
    await requireRestaurantForOwner(req, dish.restaurantId);

    await prisma.dishSuggestion.delete({
      where: { dishId_suggestedDishId: { dishId, suggestedDishId } },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.status === 400 || e.status === 403) return authErrorResponse(e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
