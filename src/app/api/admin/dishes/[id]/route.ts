import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { id } = await params;
    const body = await req.json();
    const { nombre, categoria, descripcion, precio, imagenUrl, destacado, hungerLevel, isAvailable, availableFrom, availableTo, ingredients, ingredientIds, newIngredients } = body;

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

    // Delete existing tags and recreate
    await prisma.ingredientTag.deleteMany({ where: { menuItemId: id } });

    const dish = await prisma.menuItem.update({
      where: { id },
      data: {
        ...(nombre !== undefined && { nombre }),
        ...(categoria !== undefined && { categoria }),
        ...(descripcion !== undefined && { descripcion: descripcion || null }),
        ...(precio !== undefined && { precio: Number(precio) }),
        ...(imagenUrl !== undefined && { imagenUrl: imagenUrl || null }),
        ...(destacado !== undefined && { destacado: !!destacado }),
        ...(hungerLevel !== undefined && { hungerLevel: hungerLevel || null }),
        ...(isAvailable !== undefined && { isAvailable }),
        ...(availableFrom !== undefined && { availableFrom: availableFrom || null }),
        ...(availableTo !== undefined && { availableTo: availableTo || null }),
        ...(ingredients !== undefined && { ingredients }),
        ingredientTags: allIngredientIds.length
          ? { create: allIngredientIds.map(iid => ({ ingredientId: iid })) }
          : undefined,
      },
      include: { ingredientTags: { include: { ingredient: true } } },
    });

    return NextResponse.json(dish);
  } catch (e) {
    console.error("[Admin dishes PUT]", e);
    return NextResponse.json({ error: "Error al actualizar plato" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { id } = await params;
    const dish = await prisma.menuItem.findUnique({ where: { id }, select: { imagenUrl: true } });
    if (!dish) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    // Delete image from storage if exists
    if (dish.imagenUrl?.includes("supabase")) {
      const path = dish.imagenUrl.split("/storage/v1/object/public/fotos/")[1];
      if (path) {
        await supabase.storage.from("fotos").remove([path]).catch(() => {});
      }
    }

    // Delete tags first, then dish
    await prisma.ingredientTag.deleteMany({ where: { menuItemId: id } });
    await prisma.menuItem.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[Admin dishes DELETE]", e);
    return NextResponse.json({ error: "Error al eliminar plato" }, { status: 500 });
  }
}
