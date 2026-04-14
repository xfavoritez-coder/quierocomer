import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const localId = req.nextUrl.searchParams.get("localId");
  if (!localId) return NextResponse.json({ error: "localId requerido" }, { status: 400 });

  const dishes = await prisma.menuItem.findMany({
    where: { localId },
    include: {
      ingredientTags: { include: { ingredient: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(dishes);
}

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const { localId, nombre, categoria, descripcion, precio, imagenUrl, destacado, hungerLevel, isAvailable, availableFrom, availableTo, ingredients, ingredientIds, newIngredients } = body;

    if (!localId || !nombre || !categoria || precio == null) {
      return NextResponse.json({ error: "localId, nombre, categoria y precio son requeridos" }, { status: 400 });
    }

    // Create new ingredients if any
    const allIngredientIds: string[] = [...(ingredientIds ?? [])];
    if (newIngredients?.length) {
      for (const ni of newIngredients) {
        const created = await prisma.ingredient.upsert({
          where: { name: ni.name.toLowerCase().trim() },
          update: {},
          create: { name: ni.name.toLowerCase().trim(), category: ni.category },
        });
        allIngredientIds.push(created.id);
      }
    }

    const dish = await prisma.menuItem.create({
      data: {
        localId,
        nombre,
        categoria,
        descripcion: descripcion || null,
        precio: Number(precio),
        imagenUrl: imagenUrl || null,
        destacado: !!destacado,
        hungerLevel: hungerLevel || null,
        isAvailable: isAvailable ?? true,
        availableFrom: availableFrom || null,
        availableTo: availableTo || null,
        ingredients: ingredients ?? [],
        ingredientTags: allIngredientIds.length
          ? { create: allIngredientIds.map(id => ({ ingredientId: id })) }
          : undefined,
      },
      include: { ingredientTags: { include: { ingredient: true } } },
    });

    return NextResponse.json(dish);
  } catch (e) {
    console.error("[Admin dishes POST]", e);
    return NextResponse.json({ error: "Error al crear plato" }, { status: 500 });
  }
}
