import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("panel_token")?.value;
  const panelId = req.cookies.get("panel_id")?.value;
  if (!token || !panelId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    // Virtual demo session (no real owner)
    if (token.startsWith("demo_") && panelId === "demo") {
      const demoSlug = req.cookies.get("panel_demo_slug")?.value;
      if (!demoSlug) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

      const restaurant = await prisma.restaurant.findFirst({
        where: { slug: demoSlug, isDemo: true },
        select: { id: true, name: true, slug: true, logoUrl: true, qrToken: true, plan: true, toteatApiToken: true, isDemo: true },
      });
      if (!restaurant) return NextResponse.json({ error: "Demo no encontrado" }, { status: 401 });

      const { toteatApiToken, isDemo, ...rest } = restaurant;
      return NextResponse.json({
        role: "OWNER",
        name: restaurant.name,
        restaurants: [{ ...rest, hasToteat: !!toteatApiToken, isDemo: true }],
        selectedRestaurantId: restaurant.id,
        mustChangePassword: false,
      });
    }

    const owner = await prisma.restaurantOwner.findUnique({
      where: { id: panelId },
      include: { restaurants: { select: { id: true, name: true, slug: true, logoUrl: true, qrToken: true, plan: true, toteatApiToken: true, isDemo: true } } },
    });

    if (!owner) {
      return NextResponse.json({ error: "Owner not found" }, { status: 401 });
    }

    // Demo tokens don't require ACTIVE status check
    if (!token.startsWith("demo_") && owner.status !== "ACTIVE") {
      return NextResponse.json({ error: "Cuenta no activa" }, { status: 403 });
    }

    // Don't leak the API token to the client; just expose a boolean
    const restaurants = owner.restaurants.map(({ toteatApiToken, isDemo, ...rest }) => ({
      ...rest,
      hasToteat: !!toteatApiToken,
      isDemo: !!isDemo,
    }));

    return NextResponse.json({
      role: owner.role,
      name: owner.name,
      restaurants,
      selectedRestaurantId: restaurants[0]?.id || null,
      mustChangePassword: owner.mustChangePassword,
    });
  } catch (error) {
    console.error("Panel me error:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
