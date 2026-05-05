import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin, getOwnedRestaurantIds } from "@/lib/adminAuth";
import { getToteatProductCatalog, suggestCandidatesForDishes } from "@/lib/toteat/mapping";
import crypto from "crypto";

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

  let restaurantInfo = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { toteatWebhookSecret: true, toteatImportDone: true, toteatApiToken: true },
  });

  // Auto-generar webhookSecret si tiene credenciales pero no secret (legacy)
  if (restaurantInfo?.toteatApiToken && !restaurantInfo.toteatWebhookSecret) {
    const newSecret = crypto.randomBytes(24).toString("hex");
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { toteatWebhookSecret: newSecret },
    });
    restaurantInfo = { ...restaurantInfo, toteatWebhookSecret: newSecret };
  }

  const dishes = await prisma.dish.findMany({
    where: { restaurantId, isActive: true, deletedAt: null },
    select: {
      id: true, name: true, photos: true,
      toteatProductId: true, toteatMappedAt: true, toteatMappedBy: true, toteatNoDirectMapping: true,
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

  // 3 categorias:
  // - directlyMapped: tiene toteatProductId
  // - viaModifiers: no tiene toteatProductId pero (a) toteatNoDirectMapping=true,
  //   o (b) tiene >=1 modifier mapeado y todos los mods estan mapeados
  // - unmapped: ni directo ni via modifiers
  const directlyMapped = dishes.filter((d) => d.toteatProductId);
  const candidates = dishes.filter((d) => !d.toteatProductId);

  const isMappedViaModifiers = (d: typeof dishes[number]) => {
    const allOpts = d.modifierTemplates.flatMap((t) => t.groups.flatMap((g) => g.options));
    if (allOpts.length === 0) return false;
    if (d.toteatNoDirectMapping) return allOpts.some((o) => o.toteatProductId);
    // Auto-detect: todos los modifiers mapeados
    return allOpts.every((o) => o.toteatProductId);
  };

  const viaModifiers = candidates.filter(isMappedViaModifiers);
  const unmapped = candidates.filter((d) => !isMappedViaModifiers(d));

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
  // Filtrar sugerencias cuyo toteatProductId ya esta usado por algun modifier
  // del mismo plato (caso Limonada Artesanal: sugerir Limonada Frambuesa seria
  // duplicar la atribucion de ventas).
  for (const d of unmapped) {
    const sug = suggestions[d.id];
    if (!sug) continue;
    const modIds = new Set(d.modifierTemplates.flatMap((t) => t.groups.flatMap((g) => g.options.map((o) => o.toteatProductId).filter(Boolean))));
    if (modIds.has(sug.toteatProductId)) {
      delete suggestions[d.id];
    }
  }

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

  const totalEffectivelyMapped = directlyMapped.length + viaModifiers.length;

  return NextResponse.json({
    summary: {
      total: dishes.length,
      mapped: totalEffectivelyMapped,
      mappedDirectly: directlyMapped.length,
      mappedViaModifiers: viaModifiers.length,
      unmapped: unmapped.length,
      mappedPct: dishes.length > 0 ? Math.round((totalEffectivelyMapped / dishes.length) * 100) : 0,
      catalogSize: catalog.length,
    },
    mapped: directlyMapped.map((d) => ({
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
    viaModifiers: viaModifiers.map((d) => ({
      id: d.id,
      name: d.name,
      photo: d.photos?.[0] || null,
      category: d.category?.name || null,
      isManualOverride: d.toteatNoDirectMapping,
      modifiers: modifiersByDish(d),
    })),
    unmapped: unmapped.map((d) => ({
      id: d.id,
      name: d.name,
      photo: d.photos?.[0] || null,
      category: d.category?.name || null,
      suggestion: suggestions[d.id] || null,
      hasMappedModifiers: d.modifierTemplates.flatMap((t) => t.groups.flatMap((g) => g.options)).some((o) => o.toteatProductId),
      modifiers: modifiersByDish(d),
    })),
    catalog,
    modifierCatalog,
    webhookSecret: restaurantInfo?.toteatWebhookSecret || null,
    importDone: restaurantInfo?.toteatImportDone || false,
  });
}
