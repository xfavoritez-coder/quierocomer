import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Get active promotions for a restaurant that match a guest's profile.
 * Returns the most relevant promo (or null).
 */
export async function GET(req: NextRequest) {
  try {
    const restaurantId = req.nextUrl.searchParams.get("restaurantId");
    const guestId = req.nextUrl.searchParams.get("guestId");
    if (!restaurantId) return NextResponse.json({ promo: null });

    // Get active promos
    const promos = await prisma.promotion.findMany({
      where: {
        restaurantId,
        status: "ACTIVE",
        OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }],
      },
      orderBy: { createdAt: "desc" },
    });

    if (!promos.length) return NextResponse.json({ promo: null });

    // Resolve dish details
    const allDishIds = promos.flatMap(p => p.dishIds);
    const dishes = allDishIds.length ? await prisma.dish.findMany({
      where: { id: { in: allDishIds } },
      select: { id: true, name: true, photos: true, price: true },
    }) : [];
    const dishMap = Object.fromEntries(dishes.map(d => [d.id, d]));

    // If we have a guestId, try to match with guest preferences
    let bestPromo = promos[0]; // Default: most recent

    if (guestId) {
      const guest = await prisma.guestProfile.findUnique({
        where: { id: guestId },
        select: {
          visitCount: true,
          linkedQrUser: { select: { dietType: true, restrictions: true } },
          sessions: { where: { restaurantId }, select: { dishesViewed: true }, orderBy: { startedAt: "desc" }, take: 5 },
        },
      });

      if (guest) {
        // Score each promo by relevance to guest
        const viewedDishIds = new Set<string>();
        for (const s of guest.sessions) {
          const viewed = s.dishesViewed as any[];
          if (Array.isArray(viewed)) viewed.forEach((d: any) => viewedDishIds.add(d.dishId));
        }

        let bestScore = -1;
        for (const promo of promos) {
          let score = 0;
          // Bonus if promo includes dishes the guest has viewed
          for (const dishId of promo.dishIds) {
            if (viewedDishIds.has(dishId)) score += 10;
          }
          // Bonus for higher discount
          if (promo.discountPct) score += promo.discountPct / 5;
          // Bonus for returning visitors
          if (guest.visitCount > 1) score += 5;

          if (score > bestScore) { bestScore = score; bestPromo = promo; }
        }
      }
    }

    return NextResponse.json({
      promo: {
        id: bestPromo.id,
        name: bestPromo.name,
        description: bestPromo.description,
        discountPct: bestPromo.discountPct,
        promoPrice: bestPromo.promoPrice,
        originalPrice: bestPromo.originalPrice,
        dishes: bestPromo.dishIds.map(id => dishMap[id]).filter(Boolean),
      },
    });
  } catch (error) {
    console.error("Promos error:", error);
    return NextResponse.json({ promo: null });
  }
}
