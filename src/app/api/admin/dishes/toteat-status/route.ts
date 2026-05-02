import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin, getOwnedRestaurantIds } from "@/lib/adminAuth";
import { getToteatProductCatalog, suggestCandidatesForDishes } from "@/lib/toteat/mapping";

/**
 * Returns the mapping status for a restaurant's dishes:
 *  - mapped count, unmapped list, total
 *  - the Toteat product catalog (for the dropdown)
 *  - best-guess suggestion per unmapped dish (for pre-population)
 */
export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  if (!isSuperAdmin(req)) {
    const ownedIds = await getOwnedRestaurantIds(req);
    if (!ownedIds || !ownedIds.includes(restaurantId)) {
      return NextResponse.json({ error: "No tienes acceso a este local" }, { status: 403 });
    }
  }

  const dishes = await prisma.dish.findMany({
    where: { restaurantId, isActive: true, deletedAt: null },
    select: {
      id: true, name: true, photos: true,
      toteatProductId: true, toteatMappedAt: true, toteatMappedBy: true,
      category: { select: { name: true } },
    },
    orderBy: [{ toteatProductId: "asc" }, { name: "asc" }],
  });

  const mapped = dishes.filter((d) => d.toteatProductId);
  const unmapped = dishes.filter((d) => !d.toteatProductId);

  const catalog = await getToteatProductCatalog(restaurantId);
  const catalogById = Object.fromEntries(catalog.map((c) => [c.toteatProductId, c]));

  const suggestions = await suggestCandidatesForDishes(restaurantId, unmapped.map((d) => d.id));

  return NextResponse.json({
    summary: {
      total: dishes.length,
      mapped: mapped.length,
      unmapped: unmapped.length,
      mappedPct: dishes.length > 0 ? Math.round((mapped.length / dishes.length) * 100) : 0,
      catalogSize: catalog.length,
    },
    mapped: mapped.map((d) => ({
      id: d.id,
      name: d.name,
      photo: d.photos?.[0] || null,
      category: d.category?.name || null,
      toteatProductId: d.toteatProductId,
      toteatName: catalogById[d.toteatProductId!]?.name || null,
      mappedBy: d.toteatMappedBy || "auto",
      mappedAt: d.toteatMappedAt,
    })),
    unmapped: unmapped.map((d) => ({
      id: d.id,
      name: d.name,
      photo: d.photos?.[0] || null,
      category: d.category?.name || null,
      suggestion: suggestions[d.id] || null,
    })),
    catalog,
  });
}
