import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth } from "@/lib/adminAuth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { id } = await params;
    const body = await req.json();

    const dish = await prisma.dish.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description || null }),
        ...(body.price !== undefined && { price: Number(body.price) }),
        ...(body.discountPrice !== undefined && { discountPrice: body.discountPrice ? Number(body.discountPrice) : null }),
        ...(body.photos !== undefined && { photos: body.photos }),
        ...(body.tags !== undefined && { tags: body.tags }),
        ...(body.isHero !== undefined && { isHero: body.isHero }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.ingredients !== undefined && { ingredients: body.ingredients || null }),
        ...(body.allergens !== undefined && { allergens: body.allergens || null }),
        ...(body.dishDiet !== undefined && { dishDiet: body.dishDiet }),
        ...(body.isSpicy !== undefined && { isSpicy: body.isSpicy }),
        ...(body.categoryId !== undefined && { categoryId: body.categoryId }),
        ...(body.position !== undefined && { position: body.position }),
      },
      include: { category: { select: { id: true, name: true } } },
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
    // Soft delete — just deactivate
    await prisma.dish.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[Admin dishes DELETE]", e);
    return NextResponse.json({ error: "Error al eliminar plato" }, { status: 500 });
  }
}
