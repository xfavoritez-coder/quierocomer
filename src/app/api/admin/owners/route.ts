import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

/** Create a new RestaurantOwner — superadmin only */
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const role = cookieStore.get("admin_role")?.value;
    if (role !== "SUPERADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { email, password, name, restaurantIds } = await request.json();
    if (!email || !password || !name) {
      return NextResponse.json({ error: "Email, password y nombre requeridos" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const owner = await prisma.restaurantOwner.create({
      data: {
        email,
        passwordHash,
        name,
        restaurants: restaurantIds?.length
          ? { connect: restaurantIds.map((id: string) => ({ id })) }
          : undefined,
      },
      include: { restaurants: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ ok: true, owner: { id: owner.id, email: owner.email, name: owner.name, restaurants: owner.restaurants } });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Email ya registrado" }, { status: 409 });
    }
    console.error("Create owner error:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

/** List all owners — superadmin only */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const role = cookieStore.get("admin_role")?.value;
    if (role !== "SUPERADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const owners = await prisma.restaurantOwner.findMany({
      include: { restaurants: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ owners: owners.map(o => ({ id: o.id, email: o.email, name: o.name, role: o.role, lastLoginAt: o.lastLoginAt, restaurants: o.restaurants })) });
  } catch (error) {
    console.error("List owners error:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
