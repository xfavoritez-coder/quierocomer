import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const adminId = cookieStore.get("admin_id")?.value;
    const adminRole = cookieStore.get("admin_role")?.value;
    const adminToken = cookieStore.get("admin_token")?.value;

    if (!adminId || !adminToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Superadmin
    if (adminId === "superadmin" && adminRole === "SUPERADMIN") {
      const restaurants = await prisma.restaurant.findMany({
        where: { isActive: true },
        select: { id: true, name: true, slug: true },
        orderBy: { name: "asc" },
      });
      return NextResponse.json({
        role: "SUPERADMIN",
        name: "Super Admin",
        restaurants,
        selectedRestaurantId: null, // superadmin selects manually
      });
    }

    // Owner
    const owner = await prisma.restaurantOwner.findUnique({
      where: { id: adminId },
      include: { restaurants: { select: { id: true, name: true, slug: true } } },
    });

    if (!owner) {
      return NextResponse.json({ error: "Owner not found" }, { status: 401 });
    }

    return NextResponse.json({
      role: owner.role,
      name: owner.name,
      restaurants: owner.restaurants,
      selectedRestaurantId: owner.restaurants[0]?.id || null,
    });
  } catch (error) {
    console.error("Admin me error:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
