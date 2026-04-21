import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";

/** Update an owner — superadmin only */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    const { id } = await params;
    const { email, name, status, restaurantIds } = await req.json();

    const existing = await prisma.restaurantOwner.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Owner no encontrado" }, { status: 404 });

    // Build update data
    const data: any = {};
    if (email !== undefined) data.email = email;
    if (name !== undefined) data.name = name;
    if (status !== undefined) data.status = status;

    // Handle restaurant assignment
    if (restaurantIds !== undefined) {
      // Disconnect all current, then connect new ones
      await prisma.restaurant.updateMany({
        where: { ownerId: id },
        data: { ownerId: null },
      });
      if (restaurantIds.length > 0) {
        await prisma.restaurant.updateMany({
          where: { id: { in: restaurantIds } },
          data: { ownerId: id },
        });
      }
    }

    const owner = await prisma.restaurantOwner.update({
      where: { id },
      data,
      include: { restaurants: { select: { id: true, name: true, slug: true } } },
    });

    return NextResponse.json({
      owner: {
        id: owner.id, email: owner.email, name: owner.name,
        role: owner.role, status: owner.status,
        lastLoginAt: owner.lastLoginAt, restaurants: owner.restaurants,
      },
    });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Email ya registrado" }, { status: 409 });
    }
    console.error("Update owner error:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
