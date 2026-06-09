import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, requireRestaurantForOwner, authErrorResponse } from "@/lib/adminAuth";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

  const groups = await prisma.menuGroup.findMany({
    where: { restaurantId },
    orderBy: { position: "asc" },
    include: { categories: { select: { id: true, name: true }, orderBy: { position: "asc" } } },
  });
  return NextResponse.json(groups);
}

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { restaurantId, name, description, imageUrl } = await req.json();
    if (!restaurantId || !name?.trim()) {
      return NextResponse.json({ error: "restaurantId y name requeridos" }, { status: 400 });
    }

    await requireRestaurantForOwner(req, restaurantId);

    let slug = slugify(name.trim());
    if (!slug) slug = `menu-${Date.now().toString(36)}`;

    // Ensure unique slug within restaurant
    const existing = await prisma.menuGroup.findUnique({ where: { restaurantId_slug: { restaurantId, slug } } });
    if (existing) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const maxPos = await prisma.menuGroup.findFirst({
      where: { restaurantId },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const group = await prisma.menuGroup.create({
      data: {
        restaurantId,
        name: name.trim(),
        slug,
        description: description?.trim() || null,
        imageUrl: imageUrl || null,
        position: (maxPos?.position ?? -1) + 1,
      },
      include: { categories: { select: { id: true, name: true } } },
    });

    return NextResponse.json(group);
  } catch (e: any) {
    console.error("[menu-groups] POST error:", e);
    return NextResponse.json({ error: e.message || "Error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { id, name, description, imageUrl, isActive, categoryIds } = await req.json();
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const group = await prisma.menuGroup.findUnique({ where: { id }, select: { restaurantId: true } });
    if (!group) return NextResponse.json({ error: "not found" }, { status: 404 });

    await requireRestaurantForOwner(req, group.restaurantId);

    const data: any = {};
    if (name !== undefined) data.name = name.trim();
    if (description !== undefined) data.description = description?.trim() || null;
    if (imageUrl !== undefined) data.imageUrl = imageUrl || null;
    if (isActive !== undefined) data.isActive = isActive;

    const updated = await prisma.menuGroup.update({
      where: { id },
      data,
      include: { categories: { select: { id: true, name: true } } },
    });

    // If categoryIds provided, update assignments
    if (categoryIds !== undefined && Array.isArray(categoryIds)) {
      // Unlink current categories
      await prisma.category.updateMany({
        where: { menuGroupId: id },
        data: { menuGroupId: null },
      });
      // Link new categories
      if (categoryIds.length > 0) {
        await prisma.category.updateMany({
          where: { id: { in: categoryIds }, restaurantId: group.restaurantId },
          data: { menuGroupId: id },
        });
      }
      // Re-fetch with updated categories
      const refreshed = await prisma.menuGroup.findUnique({
        where: { id },
        include: { categories: { select: { id: true, name: true }, orderBy: { position: "asc" } } },
      });
      return NextResponse.json(refreshed);
    }

    return NextResponse.json(updated);
  } catch (e: any) {
    console.error("[menu-groups] PUT error:", e);
    return NextResponse.json({ error: e.message || "Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const group = await prisma.menuGroup.findUnique({ where: { id }, select: { restaurantId: true } });
    if (!group) return NextResponse.json({ error: "not found" }, { status: 404 });

    await requireRestaurantForOwner(req, group.restaurantId);

    // Unlink categories first
    await prisma.category.updateMany({
      where: { menuGroupId: id },
      data: { menuGroupId: null },
    });

    await prisma.menuGroup.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[menu-groups] DELETE error:", e);
    return NextResponse.json({ error: e.message || "Error" }, { status: 500 });
  }
}
