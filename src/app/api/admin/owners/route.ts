import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";

/** Create a new RestaurantOwner — superadmin only */
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  if (!isSuperAdmin(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const { email, password, name, whatsapp, restaurantIds } = await req.json();
    if (!email || !password || !name) {
      return NextResponse.json({ error: "Email, password y nombre requeridos" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const owner = await prisma.restaurantOwner.create({
      data: {
        email,
        passwordHash,
        name,
        whatsapp: whatsapp ? String(whatsapp).trim() : null,
        status: "ACTIVE",
        restaurants: restaurantIds?.length
          ? { connect: restaurantIds.map((id: string) => ({ id })) }
          : undefined,
      },
      include: { restaurants: { select: { id: true, name: true } } },
    });

    return NextResponse.json({
      ok: true,
      owner: { id: owner.id, email: owner.email, name: owner.name, whatsapp: owner.whatsapp, status: owner.status, restaurants: owner.restaurants },
    });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Email ya registrado" }, { status: 409 });
    }
    console.error("Create owner error:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

/** List all owners — superadmin only */
export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  if (!isSuperAdmin(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const owners = await prisma.restaurantOwner.findMany({
      include: { restaurants: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      owners: owners.map((o) => ({
        id: o.id,
        email: o.email,
        name: o.name,
        whatsapp: o.whatsapp,
        role: o.role,
        status: o.status,
        lastLoginAt: o.lastLoginAt,
        createdAt: o.createdAt,
        restaurants: o.restaurants,
      })),
    });
  } catch (error) {
    console.error("List owners error:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
