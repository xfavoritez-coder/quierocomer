import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("panel_token")?.value;
  const panelId = req.cookies.get("panel_id")?.value;
  if (!token || !panelId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const owner = await prisma.restaurantOwner.findUnique({
      where: { id: panelId },
      include: { restaurants: { select: { id: true, name: true, slug: true, logoUrl: true } } },
    });

    if (!owner) {
      return NextResponse.json({ error: "Owner not found" }, { status: 401 });
    }

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
    console.error("Panel me error:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
