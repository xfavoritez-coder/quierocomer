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
      modifierTemplates: {
        select: {
          id: true,
          name: true,
          groups: {
            orderBy: { position: "asc" },
            select: {
              id: true,
              name: true,
              options: {
                where: { isHidden: false },
                orderBy: { position: "asc" },
                select: {
                  id: true,
                  name: true,
                  toteatProductId: true,
                  toteatMappedBy: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ toteatProductId: "asc" }, { name: "asc" }],
  });

  const mapped = dishes.filter((d) => d.toteatProductId);
  const unmapped = dishes.filter((d) => !d.toteatProductId);

  // Two catalogs:
  // - `catalog` is for parent-dish mapping (no modifier products in the dropdown)
  // - `modifierCatalog` is for mapping QC modifier options against Toteat
  //   products that the POS itself flags as modifiers (per-flavor codes).
  const [catalog, modifierCatalog] = await Promise.all([
    getToteatProductCatalog(restaurantId),
    getToteatProductCatalog(restaurantId, { includeModifiers: true }),
  ]);
  const catalogById = Object.fromEntries(modifierCatalog.map((c) => [c.toteatProductId, c]));

  const suggestions = await suggestCandidatesForDishes(restaurantId, unmapped.map((d) => d.id));

  // Flatten modifier options per dish for the UI
  const modifiersByDish = (d: typeof dishes[number]) => {
    const opts: { id: string; name: string; group: string; template: string; toteatProductId: string | null; toteatName: string | null; mappedBy: string | null }[] = [];
    for (const tpl of d.modifierTemplates) {
      for (const grp of tpl.groups) {
        for (const opt of grp.options) {
          opts.push({
            id: opt.id,
            name: opt.name,
            group: grp.name,
            template: tpl.name,
            toteatProductId: opt.toteatProductId,
            toteatName: opt.toteatProductId ? (catalogById[opt.toteatProductId]?.name || null) : null,
            mappedBy: opt.toteatMappedBy,
          });
        }
      }
    }
    return opts;
  };

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
      modifiers: modifiersByDish(d),
    })),
    unmapped: unmapped.map((d) => ({
      id: d.id,
      name: d.name,
      photo: d.photos?.[0] || null,
      category: d.category?.name || null,
      suggestion: suggestions[d.id] || null,
      modifiers: modifiersByDish(d),
    })),
    catalog,
    modifierCatalog,
  });
}
