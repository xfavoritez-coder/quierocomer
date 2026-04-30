import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, requireRestaurantForOwner, authErrorResponse } from "@/lib/adminAuth";

const INCLUDE_FULL = {
  groups: {
    orderBy: { position: "asc" as const },
    include: { options: { orderBy: { position: "asc" as const } } },
  },
  dishes: { select: { id: true, name: true } },
};

// GET — all templates for a restaurant
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

  const templates = await prisma.modifierTemplate.findMany({
    where: { restaurantId },
    orderBy: { createdAt: "desc" },
    include: INCLUDE_FULL,
  });

  return NextResponse.json(templates);
}

// POST — create template (with optional groups+options)
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { restaurantId, name, groups } = await req.json();
    if (!restaurantId || !name) return NextResponse.json({ error: "restaurantId y name requeridos" }, { status: 400 });
    await requireRestaurantForOwner(req, restaurantId);

    const template = await prisma.modifierTemplate.create({
      data: {
        restaurantId,
        name,
        groups: groups?.length ? {
          create: groups.map((g: any, gi: number) => ({
            name: g.name,
            required: g.required ?? false,
            minSelect: g.minSelect ?? 0,
            maxSelect: g.maxSelect ?? 1,
            position: gi,
            options: g.options?.length ? {
              create: g.options.map((o: any, oi: number) => ({
                name: o.name,
                priceAdjustment: o.priceAdjustment ?? 0,
                isDefault: o.isDefault ?? false,
                position: oi,
              })),
            } : undefined,
          })),
        } : undefined,
      },
      include: INCLUDE_FULL,
    });

    return NextResponse.json(template);
  } catch (e: any) {
    if (e.status) return authErrorResponse(e);
    console.error("[ModifierTemplates POST]", e);
    return NextResponse.json({ error: "Error al crear" }, { status: 500 });
  }
}

// PUT — update template, group, option, add group/option, or assign/unassign dish
export async function PUT(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const body = await req.json();

  try {
    // Assign template to dish
    if (body.assignDishId && body.templateId) {
      const template = await prisma.modifierTemplate.findUnique({ where: { id: body.templateId }, select: { restaurantId: true } });
      if (!template) return NextResponse.json({ error: "Template no encontrado" }, { status: 404 });
      await requireRestaurantForOwner(req, template.restaurantId);

      await prisma.modifierTemplate.update({
        where: { id: body.templateId },
        data: { dishes: { connect: { id: body.assignDishId } } },
      });
      return NextResponse.json({ success: true });
    }

    // Unassign template from dish
    if (body.unassignDishId && body.templateId) {
      const template = await prisma.modifierTemplate.findUnique({ where: { id: body.templateId }, select: { restaurantId: true } });
      if (!template) return NextResponse.json({ error: "Template no encontrado" }, { status: 404 });
      await requireRestaurantForOwner(req, template.restaurantId);

      await prisma.modifierTemplate.update({
        where: { id: body.templateId },
        data: { dishes: { disconnect: { id: body.unassignDishId } } },
      });
      return NextResponse.json({ success: true });
    }

    // Update template name
    if (body.templateId && body.name !== undefined) {
      const template = await prisma.modifierTemplate.findUnique({ where: { id: body.templateId }, select: { restaurantId: true } });
      if (!template) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      await requireRestaurantForOwner(req, template.restaurantId);

      const updated = await prisma.modifierTemplate.update({
        where: { id: body.templateId },
        data: { name: body.name },
        include: INCLUDE_FULL,
      });
      return NextResponse.json(updated);
    }

    // Add group to template
    if (body.addGroupToTemplate) {
      const template = await prisma.modifierTemplate.findUnique({
        where: { id: body.addGroupToTemplate },
        include: { groups: { orderBy: { position: "desc" }, take: 1 } },
      });
      if (!template) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      await requireRestaurantForOwner(req, template.restaurantId);

      const group = await prisma.modifierTemplateGroup.create({
        data: {
          templateId: body.addGroupToTemplate,
          name: body.name || "Nuevo grupo",
          required: body.required ?? false,
          minSelect: body.minSelect ?? 0,
          maxSelect: body.maxSelect ?? 1,
          position: (template.groups[0]?.position ?? -1) + 1,
        },
        include: { options: true },
      });
      import("@/lib/ai/translateContent").then(m => m.translateModifierGroup(group.id)).catch(() => {});
      return NextResponse.json(group);
    }

    // Update group
    if (body.groupId) {
      const group = await prisma.modifierTemplateGroup.findUnique({
        where: { id: body.groupId },
        include: { template: { select: { restaurantId: true } } },
      });
      if (!group) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      await requireRestaurantForOwner(req, group.template.restaurantId);

      const data: Record<string, any> = {};
      if (body.name !== undefined) data.name = body.name;
      if (body.required !== undefined) data.required = body.required;
      if (body.minSelect !== undefined) data.minSelect = body.minSelect;
      if (body.maxSelect !== undefined) data.maxSelect = body.maxSelect;

      const updated = await prisma.modifierTemplateGroup.update({ where: { id: body.groupId }, data, include: { options: { orderBy: { position: "asc" } } } });
      if (body.name !== undefined) {
        import("@/lib/ai/translateContent").then(m => m.translateModifierGroup(body.groupId)).catch(() => {});
      }
      return NextResponse.json(updated);
    }

    // Add option to group
    if (body.addOptionToGroup) {
      const group = await prisma.modifierTemplateGroup.findUnique({
        where: { id: body.addOptionToGroup },
        include: { template: { select: { restaurantId: true } }, options: { orderBy: { position: "desc" }, take: 1 } },
      });
      if (!group) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      await requireRestaurantForOwner(req, group.template.restaurantId);

      const option = await prisma.modifierTemplateOption.create({
        data: {
          groupId: body.addOptionToGroup,
          name: body.name || "Nueva opción",
          priceAdjustment: body.priceAdjustment ?? 0,
          position: (group.options[0]?.position ?? -1) + 1,
        },
      });
      import("@/lib/ai/translateContent").then(m => m.translateModifierGroup(body.addOptionToGroup)).catch(() => {});
      return NextResponse.json(option);
    }

    // Update option
    if (body.optionId) {
      const option = await prisma.modifierTemplateOption.findUnique({
        where: { id: body.optionId },
        include: { group: { include: { template: { select: { restaurantId: true } } } } },
      });
      if (!option) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      await requireRestaurantForOwner(req, option.group.template.restaurantId);

      const data: Record<string, any> = {};
      if (body.name !== undefined) data.name = body.name;
      if (body.priceAdjustment !== undefined) data.priceAdjustment = Number(body.priceAdjustment);
      if (body.isDefault !== undefined) data.isDefault = body.isDefault;
      if (body.description !== undefined) data.description = body.description;
      if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl;
      if (body.isHidden !== undefined) data.isHidden = body.isHidden;

      const updated = await prisma.modifierTemplateOption.update({ where: { id: body.optionId }, data });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  } catch (e: any) {
    if (e.status) return authErrorResponse(e);
    console.error("[ModifierTemplates PUT]", e);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

// DELETE — delete template, group, or option
export async function DELETE(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const body = await req.json();

  try {
    if (body.optionId) {
      const option = await prisma.modifierTemplateOption.findUnique({
        where: { id: body.optionId },
        include: { group: { include: { template: { select: { restaurantId: true } } } } },
      });
      if (!option) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      await requireRestaurantForOwner(req, option.group.template.restaurantId);
      await prisma.modifierTemplateOption.delete({ where: { id: body.optionId } });
      return NextResponse.json({ success: true });
    }

    if (body.groupId) {
      const group = await prisma.modifierTemplateGroup.findUnique({
        where: { id: body.groupId },
        include: { template: { select: { restaurantId: true } } },
      });
      if (!group) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      await requireRestaurantForOwner(req, group.template.restaurantId);
      await prisma.modifierTemplateGroup.delete({ where: { id: body.groupId } });
      return NextResponse.json({ success: true });
    }

    if (body.templateId) {
      const template = await prisma.modifierTemplate.findUnique({ where: { id: body.templateId }, select: { restaurantId: true } });
      if (!template) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      await requireRestaurantForOwner(req, template.restaurantId);
      await prisma.modifierTemplate.delete({ where: { id: body.templateId } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "templateId, groupId o optionId requerido" }, { status: 400 });
  } catch (e: any) {
    if (e.status) return authErrorResponse(e);
    console.error("[ModifierTemplates DELETE]", e);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
