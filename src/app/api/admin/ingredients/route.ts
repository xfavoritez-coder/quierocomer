import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin, getOwnedRestaurantIds } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const q = req.nextUrl.searchParams.get("q") ?? "";
  const dishId = req.nextUrl.searchParams.get("dishId");

  // Owners see approved + their own unapproved. Superadmin sees all.
  const nameFilter = q ? { name: { contains: q, mode: "insensitive" as const } } : {};
  let where: any = nameFilter;
  if (!isSuperAdmin(req)) {
    const ownedIds = await getOwnedRestaurantIds(req);
    const myRestaurantId = ownedIds?.[0];
    where = {
      ...nameFilter,
      OR: [
        { approved: true },
        ...(myRestaurantId ? [{ createdByRestaurantId: myRestaurantId }] : []),
      ],
    };
  }

  const ingredients = await prisma.ingredient.findMany({
    where,
    orderBy: { name: "asc" },
    select: { id: true, name: true, category: true, aliases: true, approved: true, createdAt: true, createdByRestaurantId: true, createdByRestaurant: { select: { name: true } }, allergens: { select: { id: true, name: true } } },
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
    const { name, category, originalName, restaurantId } = await req.json();
    if (!name) return NextResponse.json({ error: "name requerido" }, { status: 400 });

    const cleanName = name.toLowerCase().trim();
    const aliases = originalName && originalName.toLowerCase().trim() !== cleanName
      ? [originalName.toLowerCase().trim()]
      : [];

    // Track which restaurant created this ingredient
    let createdByRestaurantId: string | undefined;
    if (restaurantId) {
      createdByRestaurantId = restaurantId;
    } else if (!isSuperAdmin(req)) {
      const ownedIds = await getOwnedRestaurantIds(req);
      if (ownedIds?.length) createdByRestaurantId = ownedIds[0];
    }

    // Superadmin creates approved, owners create unapproved
    const isApproved = isSuperAdmin(req) && !restaurantId;

    const ingredient = await prisma.ingredient.upsert({
      where: { name: cleanName },
      update: aliases.length > 0 ? { aliases: { push: aliases[0] } } : {},
      create: { name: cleanName, category: category || "OTHER", aliases, approved: isApproved, ...(createdByRestaurantId ? { createdByRestaurantId } : {}) },
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
    const body = await req.json();
    const { id, name, category, addAlias, mergeInto, linkToDishes } = body;
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    // Link ingredient to multiple dishes at once
    if (linkToDishes && Array.isArray(linkToDishes)) {
      for (const dishId of linkToDishes) {
        const exists = await prisma.dishIngredient.findFirst({ where: { dishId, ingredientId: id } });
        if (!exists) {
          await prisma.dishIngredient.create({ data: { dishId, ingredientId: id } });
        }
      }
      // Update text field on each dish
      for (const dishId of linkToDishes) {
        const ings = await prisma.dishIngredient.findMany({ where: { dishId }, include: { ingredient: { select: { name: true } } } });
        await prisma.dish.update({ where: { id: dishId }, data: { ingredients: ings.map(i => i.ingredient.name).join(", ") || null } });
      }
      return NextResponse.json({ success: true, linked: linkToDishes.length });
    }

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

    // Remove alias from ingredient
    if (body.removeAlias) {
      const current = await prisma.ingredient.findUnique({ where: { id }, select: { aliases: true } });
      const updated = (current?.aliases || []).filter(a => a !== body.removeAlias);
      const ingredient = await prisma.ingredient.update({
        where: { id },
        data: { aliases: updated },
      });
      return NextResponse.json({ ingredient });
    }

    // Approve ingredient
    if (body.approve !== undefined) {
      const ingredient = await prisma.ingredient.update({ where: { id }, data: { approved: body.approve } });
      return NextResponse.json({ ingredient });
    }

    const data: Record<string, any> = {};
    if (name !== undefined) data.name = name.toLowerCase().trim();
    if (category !== undefined) data.category = category;
    const ingredient = await prisma.ingredient.update({ where: { id }, data });

    // If name changed, update text field on all linked dishes
    if (name !== undefined) {
      const links = await prisma.dishIngredient.findMany({ where: { ingredientId: id }, select: { dishId: true } });
      for (const link of links) {
        const dishIngs = await prisma.dishIngredient.findMany({ where: { dishId: link.dishId }, include: { ingredient: { select: { name: true } } } });
        await prisma.dish.update({ where: { id: link.dishId }, data: { ingredients: dishIngs.map(di => di.ingredient.name).join(", ") || null } });
      }
    }

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

    // Unlink from all dishes first
    const links = await prisma.dishIngredient.findMany({ where: { ingredientId: id }, select: { dishId: true } });
    await prisma.dishIngredient.deleteMany({ where: { ingredientId: id } });

    // Update text field on affected dishes
    for (const link of links) {
      const remaining = await prisma.dishIngredient.findMany({ where: { dishId: link.dishId }, include: { ingredient: { select: { name: true } } } });
      await prisma.dish.update({ where: { id: link.dishId }, data: { ingredients: remaining.map(r => r.ingredient.name).join(", ") || null } });
    }

    await prisma.ingredient.delete({ where: { id } });
    return NextResponse.json({ success: true, unlinked: links.length });
  } catch (e) {
    console.error("[Admin ingredients DELETE]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
