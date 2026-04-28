import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, requireRestaurantForOwner, authErrorResponse } from "@/lib/adminAuth";
import { translateCategory } from "@/lib/ai/translateContent";

const DRINK_KW = ["bebida", "trago", "cerveza", "jugo", "vino", "cocktail", "mocktail", "sour", "schop", "café", "cafe", "coffee", "té", "infusion", "agua", "drink"];
const SWEET_KW = ["postre", "dulce", "kuchen", "torta", "helado", "dessert"];
const EXTRA_KW = ["extra", "adicional", "agregado", "complemento", "topping", "salsa"];

function inferDishType(name: string): "food" | "drink" | "dessert" | "extra" {
  const n = name.toLowerCase();
  if (EXTRA_KW.some(kw => n.includes(kw))) return "extra";
  if (DRINK_KW.some(kw => n.includes(kw))) return "drink";
  if (SWEET_KW.some(kw => n.includes(kw))) return "dessert";
  return "food";
}

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "restaurantId requerido" }, { status: 400 });

  try {
    await requireRestaurantForOwner(req, restaurantId);
  } catch (e) {
    return authErrorResponse(e);
  }

  const categories = await prisma.category.findMany({
    where: { restaurantId },
    orderBy: { position: "asc" },
    include: { _count: { select: { dishes: true } } },
  });
  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { restaurantId, name, description, dishType } = await req.json();
    if (!restaurantId || !name) {
      return NextResponse.json({ error: "restaurantId y name requeridos" }, { status: 400 });
    }

    await requireRestaurantForOwner(req, restaurantId);

    const maxPos = await prisma.category.findFirst({
      where: { restaurantId },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const category = await prisma.category.create({
      data: {
        restaurantId,
        name,
        description: description || null,
        dishType: dishType || inferDishType(name),
        position: (maxPos?.position ?? -1) + 1,
      },
    });

    // Translate category name to en/pt in background
    translateCategory(category.id).catch((e) => console.error("[translate cat]", e));

    return NextResponse.json(category);
  } catch (e: any) {
    if (e.status) return authErrorResponse(e);
    console.error("[Admin categories POST]", e);
    return NextResponse.json({ error: "Error al crear categoría" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { id, name, description, position, isActive, dishType } = await req.json();
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const existing = await prisma.category.findUnique({ where: { id }, select: { restaurantId: true } });
    if (!existing) return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });

    await requireRestaurantForOwner(req, existing.restaurantId);

    const data: Record<string, any> = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description || null;
    if (position !== undefined) data.position = position;
    if (isActive !== undefined) data.isActive = isActive;
    if (dishType !== undefined) data.dishType = dishType;

    const updated = await prisma.category.update({ where: { id }, data });

    // Re-translate if name changed
    if (name !== undefined) {
      await prisma.categoryTranslation.updateMany({
        where: { categoryId: id, isManual: false },
        data: { name: "" },
      });
      translateCategory(id).catch((e) => console.error("[translate cat]", e));
    }

    return NextResponse.json(updated);
  } catch (e: any) {
    if (e.status) return authErrorResponse(e);
    console.error("[Admin categories PUT]", e);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const existing = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { dishes: true } } },
    });
    if (!existing) return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });

    await requireRestaurantForOwner(req, existing.restaurantId);

    const activeDishes = await prisma.dish.count({ where: { categoryId: id, isActive: true } });
    if (activeDishes > 0) {
      return NextResponse.json({ error: `No se puede eliminar: tiene ${activeDishes} plato(s) activo(s). Mueve o elimina los platos primero.` }, { status: 400 });
    }

    // Delete soft-deleted dishes first to clear foreign key constraints
    await prisma.dish.deleteMany({ where: { categoryId: id, isActive: false } });
    await prisma.category.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e.status) return authErrorResponse(e);
    console.error("[Admin categories DELETE]", e);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
