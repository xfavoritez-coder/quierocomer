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
        select: { id: true, name: true, slug: true, logoUrl: true, qrToken: true, plan: true, subscriptionStatus: true, toteatApiToken: true, isDemo: true, multiMenuEnabled: true, controlEnabled: true, financialEnabled: true, orderingEnabled: true, reviewMode: true, googleReviewUrl: true, reviewReward: true, profileType: true, ecommerceEnabled: true, bodegaEnabled: true, centroPedidosEnabled: true, posEnabled: true, orderingNavHidden: true, viewerSections: true, ecommerceStoreConfig: true },
      });
      if (!restaurant) return NextResponse.json({ error: "Demo no encontrado" }, { status: 401 });

      const { toteatApiToken, isDemo, controlEnabled: _ce, financialEnabled: _fe, ecommerceStoreConfig, ...rest } = restaurant;
      const branchName = (ecommerceStoreConfig as { branchName?: string | null } | null)?.branchName ?? null;
      return NextResponse.json({
        role: "OWNER",
        name: restaurant.name,
        restaurants: [{ ...rest, branchName, hasToteat: !!toteatApiToken, isDemo: true, hasControl: !!_ce, hasFinancial: true }],
        selectedRestaurantId: restaurant.id,
        mustChangePassword: false,
      });
    }

    // Team member login (id prefixed with "tm_")
    if (panelId.startsWith("tm_")) {
      const memberId = panelId.slice(3);
      const member = await prisma.teamMember.findUnique({
        where: { id: memberId },
        select: { id: true, name: true, role: true, status: true, email: true, restaurantId: true, seenFeatures: true, restaurant: { select: { ownerId: true } } },
      });

      if (!member) return NextResponse.json({ error: "User not found" }, { status: 401 });
      if (member.status !== "ACTIVE") return NextResponse.json({ error: "Cuenta no activa" }, { status: 403 });

      // Un usuario de equipo puede tener acceso a varias sucursales (una fila
      // TeamMember por local, mismo email, del mismo dueño). Devolvemos todas.
      const ownerId = member.restaurant?.ownerId || null;
      const siblings = await prisma.teamMember.findMany({
        where: {
          email: { equals: member.email, mode: "insensitive" },
          status: "ACTIVE",
          ...(ownerId ? { restaurant: { ownerId } } : { restaurantId: member.restaurantId }),
        },
        select: { role: true, restaurant: { select: { id: true, name: true, slug: true, logoUrl: true, qrToken: true, plan: true, subscriptionStatus: true, toteatApiToken: true, isDemo: true, multiMenuEnabled: true, controlEnabled: true, financialEnabled: true, orderingEnabled: true, reviewMode: true, googleReviewUrl: true, reviewReward: true, profileType: true, ecommerceEnabled: true, bodegaEnabled: true, centroPedidosEnabled: true, posEnabled: true, orderingNavHidden: true, viewerSections: true, ecommerceStoreConfig: true } } },
        orderBy: { restaurant: { createdAt: "asc" } },
      });

      const seen = new Set<string>();
      const restaurants = siblings
        .filter((s) => {
          if (!s.restaurant || seen.has(s.restaurant.id)) return false;
          seen.add(s.restaurant.id);
          return true;
        })
        .map((s) => {
          const { toteatApiToken, isDemo, controlEnabled, financialEnabled, ecommerceStoreConfig, ...rest } = s.restaurant!;
          return { ...rest, branchName: (ecommerceStoreConfig as { branchName?: string | null } | null)?.branchName ?? null, hasToteat: !!toteatApiToken, isDemo: !!isDemo, hasControl: !!controlEnabled, hasFinancial: true };
        });

      return NextResponse.json({
        role: member.role,
        name: member.name,
        restaurants,
        selectedRestaurantId: member.restaurantId,
        teamMember: true,
        mustChangePassword: false,
        seenFeatures: member.seenFeatures || [],
      });
    }

    const owner = await prisma.restaurantOwner.findUnique({
      where: { id: panelId },
      include: { restaurants: { select: { id: true, name: true, slug: true, logoUrl: true, qrToken: true, plan: true, subscriptionStatus: true, toteatApiToken: true, isDemo: true, multiMenuEnabled: true, controlEnabled: true, financialEnabled: true, orderingEnabled: true, reviewMode: true, googleReviewUrl: true, reviewReward: true, profileType: true, ecommerceEnabled: true, bodegaEnabled: true, centroPedidosEnabled: true, posEnabled: true, orderingNavHidden: true, viewerSections: true, ecommerceStoreConfig: true }, orderBy: { createdAt: 'asc' } } },
    });

    if (!owner) {
      return NextResponse.json({ error: "Owner not found" }, { status: 401 });
    }

    // Demo tokens don't require ACTIVE status check
    if (!token.startsWith("demo_") && owner.status !== "ACTIVE") {
      return NextResponse.json({ error: "Cuenta no activa" }, { status: 403 });
    }

    // Don't leak the API token to the client; just expose a boolean
    const restaurants = owner.restaurants.map(({ toteatApiToken, isDemo, controlEnabled, financialEnabled, ecommerceStoreConfig, ...rest }) => ({
      ...rest,
      branchName: (ecommerceStoreConfig as { branchName?: string | null } | null)?.branchName ?? null,
      hasToteat: !!toteatApiToken,
      isDemo: !!isDemo,
      hasControl: !!controlEnabled,
      hasFinancial: true,
    }));

    return NextResponse.json({
      role: owner.role,
      name: owner.name,
      restaurants,
      selectedRestaurantId: restaurants[0]?.id || null,
      mustChangePassword: owner.mustChangePassword,
      seenFeatures: owner.seenFeatures || [],
    });
  } catch (error) {
    console.error("Panel me error:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
