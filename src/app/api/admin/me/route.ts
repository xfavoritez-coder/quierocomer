import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, getAdminId, getAdminRole } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const adminId = getAdminId(req);
    const adminRole = getAdminRole(req);

    // Superadmin
    if (adminId === "superadmin" && adminRole === "SUPERADMIN") {
      const rows = await prisma.restaurant.findMany({
        where: { isActive: true },
        select: { id: true, name: true, slug: true, logoUrl: true, qrToken: true, toteatApiToken: true },
        orderBy: { name: "asc" },
      });
      const restaurants = rows.map(({ toteatApiToken, ...rest }) => ({ ...rest, hasToteat: !!toteatApiToken }));
      return NextResponse.json({
        role: "SUPERADMIN",
        name: "Super Admin",
        restaurants,
        selectedRestaurantId: null,
      });
    }

    // Owner
    const owner = await prisma.restaurantOwner.findUnique({
      where: { id: adminId! },
      include: { restaurants: { select: { id: true, name: true, slug: true, logoUrl: true, qrToken: true, toteatApiToken: true } } },
    });

    if (!owner) {
      return NextResponse.json({ error: "Owner not found" }, { status: 401 });
    }

    // Block suspended/pending owners from accessing the panel
    if (owner.status !== "ACTIVE") {
      return NextResponse.json({ error: "Cuenta no activa" }, { status: 403 });
    }

    const restaurants = owner.restaurants.map(({ toteatApiToken, ...rest }) => ({ ...rest, hasToteat: !!toteatApiToken }));
    return NextResponse.json({
      role: owner.role,
      name: owner.name,
      restaurants,
      selectedRestaurantId: restaurants[0]?.id || null,
    });
  } catch (error) {
    console.error("Admin me error:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
