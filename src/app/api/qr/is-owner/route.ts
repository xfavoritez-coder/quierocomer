import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/qr/is-owner?restaurantId=xxx
 * Returns { isOwner: true } if the current panel session owns this restaurant.
 * Used by OwnerBanner to avoid showing admin UI to random visitors.
 */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ isOwner: false });

  const panelToken = req.cookies.get("panel_token")?.value;
  const panelId = req.cookies.get("panel_id")?.value;

  // Only show banner if user has an active panel session for a specific restaurant
  if (!panelToken || !panelId) {
    return NextResponse.json({ isOwner: false });
  }

  // Demo session — check panel_demo_slug matches
  if (panelId === "demo") {
    const demoSlug = req.cookies.get("panel_demo_slug")?.value;
    if (!demoSlug) return NextResponse.json({ isOwner: false });
    const restaurant = await prisma.restaurant.findFirst({
      where: { id: restaurantId, slug: demoSlug },
      select: { id: true },
    });
    return NextResponse.json({ isOwner: !!restaurant });
  }

  // Team member
  if (panelId.startsWith("tm_")) {
    const memberId = panelId.slice(3);
    const member = await prisma.teamMember.findUnique({
      where: { id: memberId },
      select: { restaurantId: true },
    });
    return NextResponse.json({ isOwner: member?.restaurantId === restaurantId });
  }

  // Regular owner — check they own this restaurant
  const owner = await prisma.restaurantOwner.findUnique({
    where: { id: panelId },
    select: { restaurants: { where: { id: restaurantId }, select: { id: true } } },
  });

  return NextResponse.json({ isOwner: (owner?.restaurants?.length ?? 0) > 0 });
}
