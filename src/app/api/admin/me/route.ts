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
      const restaurants = await prisma.restaurant.findMany({
        where: { isActive: true },
        select: { id: true, name: true, slug: true, logoUrl: true, qrToken: true },
        orderBy: { name: "asc" },
      });
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
      include: { restaurants: { select: { id: true, name: true, slug: true, logoUrl: true, qrToken: true } } },
    });

    if (!owner) {
      return NextResponse.json({ error: "Owner not found" }, { status: 401 });
    }

    // Block suspended/pending owners from accessing the panel
    if (owner.status !== "ACTIVE") {
      return NextResponse.json({ error: "Cuenta no activa" }, { status: 403 });
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
