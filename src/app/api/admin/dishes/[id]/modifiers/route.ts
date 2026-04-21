import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, assertOwnsRestaurant, authErrorResponse } from "@/lib/adminAuth";

// GET — fetch all modifier groups + options for a dish
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const { id } = await params;
  const dish = await prisma.dish.findUnique({ where: { id }, select: { restaurantId: true } });
  if (!dish) return NextResponse.json({ error: "Plato no encontrado" }, { status: 404 });

  try {
    await assertOwnsRestaurant(req, dish.restaurantId);
  } catch (e) {
    return authErrorResponse(e);
  }

  const groups = await prisma.dishModifierGroup.findMany({
    where: { dishId: id },
    orderBy: { position: "asc" },
    include: { options: { orderBy: { position: "asc" } } },
  });

  return NextResponse.json(groups);
}

// POST — create a new modifier group (with optional initial options)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const { id } = await params;
  const dish = await prisma.dish.findUnique({ where: { id }, select: { restaurantId: true } });
  if (!dish) return NextResponse.json({ error: "Plato no encontrado" }, { status: 404 });

  try {
    await assertOwnsRestaurant(req, dish.restaurantId);
  } catch (e) {
    return authErrorResponse(e);
  }

  const { name, required, minSelect, maxSelect, options } = await req.json();
  if (!name) return NextResponse.json({ error: "name requerido" }, { status: 400 });

  const maxPos = await prisma.dishModifierGroup.findFirst({
    where: { dishId: id },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const group = await prisma.dishModifierGroup.create({
    data: {
      dishId: id,
      name,
      required: required ?? false,
      minSelect: minSelect ?? 0,
      maxSelect: maxSelect ?? 1,
      position: (maxPos?.position ?? -1) + 1,
      options: options?.length ? {
        create: options.map((o: any, i: number) => ({
          name: o.name,
          priceAdjustment: o.priceAdjustment ?? 0,
          isDefault: o.isDefault ?? false,
          position: i,
        })),
      } : undefined,
    },
    include: { options: { orderBy: { position: "asc" } } },
  });

  return NextResponse.json(group);
}

// PUT — update a modifier group OR an option
export async function PUT(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const body = await req.json();

  try {
    // Update option
    if (body.optionId) {
      const option = await prisma.dishModifierOption.findUnique({
        where: { id: body.optionId },
        include: { group: { include: { dish: { select: { restaurantId: true } } } } },
      });
      if (!option) return NextResponse.json({ error: "Opción no encontrada" }, { status: 404 });
      await assertOwnsRestaurant(req, option.group.dish.restaurantId);

      const data: Record<string, any> = {};
      if (body.name !== undefined) data.name = body.name;
      if (body.priceAdjustment !== undefined) data.priceAdjustment = Number(body.priceAdjustment);
      if (body.isDefault !== undefined) data.isDefault = body.isDefault;
      if (body.position !== undefined) data.position = body.position;

      const updated = await prisma.dishModifierOption.update({ where: { id: body.optionId }, data });
      return NextResponse.json(updated);
    }

    // Update group
    if (body.groupId) {
      const group = await prisma.dishModifierGroup.findUnique({
        where: { id: body.groupId },
        include: { dish: { select: { restaurantId: true } } },
      });
      if (!group) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
      await assertOwnsRestaurant(req, group.dish.restaurantId);

      const data: Record<string, any> = {};
      if (body.name !== undefined) data.name = body.name;
      if (body.required !== undefined) data.required = body.required;
      if (body.minSelect !== undefined) data.minSelect = body.minSelect;
      if (body.maxSelect !== undefined) data.maxSelect = body.maxSelect;
      if (body.position !== undefined) data.position = body.position;

      const updated = await prisma.dishModifierGroup.update({
        where: { id: body.groupId },
        data,
        include: { options: { orderBy: { position: "asc" } } },
      });
      return NextResponse.json(updated);
    }

    // Add option to group
    if (body.addOptionToGroup) {
      const group = await prisma.dishModifierGroup.findUnique({
        where: { id: body.addOptionToGroup },
        include: { dish: { select: { restaurantId: true } }, options: { orderBy: { position: "desc" }, take: 1 } },
      });
      if (!group) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
      await assertOwnsRestaurant(req, group.dish.restaurantId);

      const option = await prisma.dishModifierOption.create({
        data: {
          groupId: body.addOptionToGroup,
          name: body.name || "Nueva opción",
          priceAdjustment: body.priceAdjustment ?? 0,
          isDefault: body.isDefault ?? false,
          position: (group.options[0]?.position ?? -1) + 1,
        },
      });
      return NextResponse.json(option);
    }

    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  } catch (e: any) {
    if (e.status) return authErrorResponse(e);
    console.error("[Modifiers PUT]", e);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

// DELETE — delete a group or option
export async function DELETE(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const body = await req.json();

  try {
    if (body.optionId) {
      const option = await prisma.dishModifierOption.findUnique({
        where: { id: body.optionId },
        include: { group: { include: { dish: { select: { restaurantId: true } } } } },
      });
      if (!option) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      await assertOwnsRestaurant(req, option.group.dish.restaurantId);
      await prisma.dishModifierOption.delete({ where: { id: body.optionId } });
      return NextResponse.json({ success: true });
    }

    if (body.groupId) {
      const group = await prisma.dishModifierGroup.findUnique({
        where: { id: body.groupId },
        include: { dish: { select: { restaurantId: true } } },
      });
      if (!group) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      await assertOwnsRestaurant(req, group.dish.restaurantId);
      await prisma.dishModifierGroup.delete({ where: { id: body.groupId } }); // cascade deletes options
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "optionId o groupId requerido" }, { status: 400 });
  } catch (e: any) {
    if (e.status) return authErrorResponse(e);
    console.error("[Modifiers DELETE]", e);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
