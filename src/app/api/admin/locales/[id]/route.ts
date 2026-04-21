import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth } from "@/lib/adminAuth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  const { id } = await params;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      categories: { orderBy: { position: "asc" }, select: { id: true, name: true, position: true, isActive: true } },
      _count: { select: { dishes: true, statEvents: true, sessions: true, waiterCalls: true } },
    },
  });
  if (!restaurant) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(restaurant);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  const { id } = await params;

  try {
    const body = await req.json();
    const restaurant = await prisma.restaurant.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.slug !== undefined && { slug: body.slug }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.address !== undefined && { address: body.address }),
        ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl }),
        ...(body.bannerUrl !== undefined && { bannerUrl: body.bannerUrl }),
        ...(body.cartaTheme !== undefined && { cartaTheme: body.cartaTheme }),
        ...(body.defaultView !== undefined && { defaultView: body.defaultView || null }),
        ...(body.qrActivatedAt !== undefined && { qrActivatedAt: body.qrActivatedAt ? new Date(body.qrActivatedAt) : null }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.ownerId !== undefined && { ownerId: body.ownerId || null }),
      },
    });
    return NextResponse.json(restaurant);
  } catch (e) {
    console.error("[Admin restaurant PUT]", e);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  const { id } = await params;

  try {
    await prisma.restaurant.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[Admin restaurant DELETE]", e);
    return NextResponse.json({ error: "Error al desactivar" }, { status: 500 });
  }
}
