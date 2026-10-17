import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseStoreConfig } from "@/lib/ecommerce/store-config";

export const runtime = "nodejs";

// Campos del plato que se copian (los que afectan la carta y el pedido). Se
// omiten embeddings, traducciones, sugerencias y mapeos internos.
const DISH_FIELDS = [
  "name", "description", "detailedDescription", "price", "discountPrice", "photos", "tags",
  "isHero", "isActive", "stockCountdown", "soldOut", "ingredients", "allergens", "position",
  "dishDiet", "isSpicy", "flavorTags", "isHighMargin", "isPhotoReferential",
  "isGlutenFree", "isLactoseFree", "isSoyFree", "containsNuts", "hiddenFromFeed",
  "hideFromOrdering", "ecommerceOnly", "toteatProductId", "photoCredits",
  "txDishType", "txCuisine", "txMealSlot", "txIngredient", "txEstilo",
] as const;

/**
 * POST /api/panel/ecommerce/catalog/copy-to-branches  { restaurantId }
 * Copia (REEMPLAZA) la carta del local origen a todas las sucursales de la misma
 * marca (mismo brandSlug) y mismo dueño. Catálogo por sucursal (opción A).
 */
export async function POST(req: NextRequest) {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });

  const source = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true, ownerId: true, ecommerceStoreConfig: true } });
  if (!source) return NextResponse.json({ error: "Local no encontrado" }, { status: 404 });
  // Solo el dueño (acción que afecta varios locales).
  if (!source.ownerId || source.ownerId !== panelId) return NextResponse.json({ error: "Solo el dueño de la cuenta puede copiar la carta a las sucursales" }, { status: 403 });

  const brandSlug = parseStoreConfig(source.ecommerceStoreConfig).brandSlug;
  if (!brandSlug) return NextResponse.json({ error: "Configura primero el identificador de marca (Web y marca)." }, { status: 400 });

  const targets = await prisma.restaurant.findMany({
    where: { ownerId: source.ownerId, id: { not: source.id }, ecommerceStoreConfig: { path: ["brandSlug"], equals: brandSlug } },
    select: { id: true, name: true },
  });
  if (!targets.length) return NextResponse.json({ error: "No hay otras sucursales con esa marca." }, { status: 400 });

  // Leer la carta del origen.
  const srcTemplates = await prisma.modifierTemplate.findMany({
    where: { restaurantId: source.id },
    select: { id: true, name: true, scope: true, groups: { orderBy: { position: "asc" }, select: { id: true, name: true, required: true, minSelect: true, maxSelect: true, position: true, options: { orderBy: { position: "asc" }, select: { name: true, priceAdjustment: true, isDefault: true, position: true, description: true, imageUrl: true, isHidden: true, soldOut: true, toteatProductId: true } } } } },
  });
  const srcCats = await prisma.category.findMany({
    where: { restaurantId: source.id },
    orderBy: { position: "asc" },
    select: { id: true, name: true, description: true, position: true, isActive: true, dishType: true, cuisineTag: true, normOverride: true, scheduleDays: true, scheduleStart: true, scheduleEnd: true },
  });
  const srcDishes = await prisma.dish.findMany({
    where: { restaurantId: source.id, deletedAt: null },
    orderBy: { position: "asc" },
    select: { categoryId: true, modifierTemplates: { select: { id: true } }, ...Object.fromEntries(DISH_FIELDS.map((f) => [f, true])) } as any,
  });

  let dishesCopied = 0;
  for (const target of targets) {
    await prisma.$transaction(async (tx) => {
      // Borrar la carta actual de la sucursal (dishes → categories → templates).
      await tx.dish.deleteMany({ where: { restaurantId: target.id } });
      await tx.category.deleteMany({ where: { restaurantId: target.id } });
      await tx.modifierTemplate.deleteMany({ where: { restaurantId: target.id } });

      // Plantillas de modificadores.
      const tmplMap = new Map<string, string>();
      for (const t of srcTemplates) {
        const nt = await tx.modifierTemplate.create({ data: { restaurantId: target.id, name: t.name, scope: t.scope }, select: { id: true } });
        tmplMap.set(t.id, nt.id);
        for (const g of t.groups) {
          const ng = await tx.modifierTemplateGroup.create({ data: { templateId: nt.id, name: g.name, required: g.required, minSelect: g.minSelect, maxSelect: g.maxSelect, position: g.position }, select: { id: true } });
          if (g.options.length) await tx.modifierTemplateOption.createMany({ data: g.options.map((o) => ({ groupId: ng.id, ...o })) });
        }
      }

      // Categorías.
      const catMap = new Map<string, string>();
      for (const c of srcCats) {
        const { id, ...cf } = c;
        const nc = await tx.category.create({ data: { restaurantId: target.id, ...cf }, select: { id: true } });
        catMap.set(id, nc.id);
      }

      // Platos (con reconexión a las plantillas copiadas).
      for (const d of srcDishes as unknown as Array<Record<string, unknown> & { categoryId: string; modifierTemplates: { id: string }[] }>) {
        const { categoryId, modifierTemplates, ...fields } = d;
        const newCat = catMap.get(categoryId);
        if (!newCat) continue;
        await tx.dish.create({
          data: {
            ...(fields as object),
            restaurantId: target.id,
            categoryId: newCat,
            modifierTemplates: { connect: modifierTemplates.map((m) => ({ id: tmplMap.get(m.id)! })).filter((x) => x.id) },
          } as any,
        });
        dishesCopied++;
      }
    }, { timeout: 120000, maxWait: 15000 });
  }

  return NextResponse.json({ ok: true, branches: targets.length, branchNames: targets.map((t) => t.name), dishesPerBranch: srcDishes.length });
}
