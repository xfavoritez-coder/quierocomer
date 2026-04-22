import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const q = req.nextUrl.searchParams.get("q") ?? "";
  const dishId = req.nextUrl.searchParams.get("dishId");

  const ingredients = await prisma.ingredient.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : {},
    orderBy: { name: "asc" },
    select: { id: true, name: true, category: true, isAllergen: true, allergenType: true },
  });

  let linkedIds: string[] = [];
  if (dishId) {
    const links = await prisma.dishIngredient.findMany({ where: { dishId }, select: { ingredientId: true } });
    linkedIds = links.map(l => l.ingredientId);
  }

  const ignored = await prisma.ignoredIngredient.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

  return NextResponse.json({ ingredients, linkedIds, ignored });
}

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { name, category, originalName } = await req.json();
    if (!name) return NextResponse.json({ error: "name requerido" }, { status: 400 });

    const cleanName = name.toLowerCase().trim();
    const aliases = originalName && originalName.toLowerCase().trim() !== cleanName
      ? [originalName.toLowerCase().trim()]
      : [];

    const ingredient = await prisma.ingredient.upsert({
      where: { name: cleanName },
      update: aliases.length > 0 ? { aliases: { push: aliases[0] } } : {},
      create: { name: cleanName, category: category || "OTHER", aliases },
    });
    return NextResponse.json({ ingredient });
  } catch (e) {
    console.error("[Admin ingredients POST]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    const { id, name, category, isAllergen, allergenType, addAlias, mergeInto } = await req.json();
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    // Merge: reassign all dish links from this ingredient to target, then delete
    if (mergeInto) {
      // Reassign all DishIngredient links
      const links = await prisma.dishIngredient.findMany({ where: { ingredientId: id } });
      for (const link of links) {
        // Check if target already linked to this dish
        const exists = await prisma.dishIngredient.findFirst({ where: { dishId: link.dishId, ingredientId: mergeInto } });
        if (!exists) {
          await prisma.dishIngredient.update({ where: { id: link.id }, data: { ingredientId: mergeInto } });
        } else {
          await prisma.dishIngredient.delete({ where: { id: link.id } });
        }
      }
      // Delete the source ingredient
      await prisma.ingredient.delete({ where: { id } });
      return NextResponse.json({ success: true, merged: links.length });
    }

    // Add alias to existing ingredient
    if (addAlias) {
      const alias = addAlias.toLowerCase().trim();
      const ingredient = await prisma.ingredient.update({
        where: { id },
        data: { aliases: { push: alias } },
      });
      return NextResponse.json({ ingredient });
    }

    const data: Record<string, any> = {};
    if (name !== undefined) data.name = name.toLowerCase().trim();
    if (category !== undefined) data.category = category;
    if (isAllergen !== undefined) data.isAllergen = isAllergen;
    if (allergenType !== undefined) data.allergenType = allergenType || null;

    const ingredient = await prisma.ingredient.update({ where: { id }, data });
    return NextResponse.json({ ingredient });
  } catch (e) {
    console.error("[Admin ingredients PUT]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    const { id, ignoreName, unignoreId } = await req.json();

    // Add to ignored list
    if (ignoreName) {
      await prisma.ignoredIngredient.upsert({
        where: { name: ignoreName.toLowerCase().trim() },
        update: {},
        create: { name: ignoreName.toLowerCase().trim() },
      });
      return NextResponse.json({ success: true });
    }

    // Remove from ignored list
    if (unignoreId) {
      await prisma.ignoredIngredient.delete({ where: { id: unignoreId } });
      return NextResponse.json({ success: true });
    }

    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    // Check if used
    const count = await prisma.dishIngredient.count({ where: { ingredientId: id } });
    if (count > 0) return NextResponse.json({ error: `No se puede eliminar: usado en ${count} plato(s)` }, { status: 400 });

    await prisma.ingredient.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[Admin ingredients DELETE]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
