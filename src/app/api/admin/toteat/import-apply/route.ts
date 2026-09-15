import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, getOwnedRestaurantIds, isSuperAdmin } from "@/lib/adminAuth";

/**
 * POST /api/admin/toteat/import-apply
 * Body: {
 *   restaurantId,
 *   actions: [
 *     { toteatId, action: "map" | "create" | "skip", dishId?, name?, price?, category? }
 *   ]
 * }
 *
 * Aplica las decisiones del wizard:
 * - map → setea Dish.toteatProductId (nunca sobrescribe foto/descripcion/etc)
 * - create → crea un Dish nuevo con name+price y toteatProductId+toteatSynced=true
 * - skip → no hace nada
 *
 * Al terminar, marca Restaurant.toteatImportDone=true.
 */
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }
  const restaurantId = body?.restaurantId as string | undefined;
  const actions = body?.actions as Array<{ toteatId: string; action: "map" | "create" | "skip"; dishId?: string; name?: string; price?: number; category?: string }>;

  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });
  if (!Array.isArray(actions)) return NextResponse.json({ error: "actions array required" }, { status: 400 });

  if (!isSuperAdmin(req)) {
    const ownedIds = await getOwnedRestaurantIds(req);
    if (!ownedIds || !ownedIds.includes(restaurantId)) {
      return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
    }
  }

  // Categoria default para nuevos platos: "Importados de Toteat" (la creamos si no existe)
  let importCategoryId: string | null = null;
  const importCatActions = actions.filter((a) => a.action === "create");
  if (importCatActions.length > 0) {
    const existing = await prisma.category.findFirst({ where: { restaurantId, name: "Importados de Toteat" } });
    if (existing) {
      importCategoryId = existing.id;
    } else {
      const lastPos = await prisma.category.findFirst({ where: { restaurantId }, orderBy: { position: "desc" }, select: { position: true } });
      const created = await prisma.category.create({
        data: {
          restaurantId,
          name: "Importados de Toteat",
          position: (lastPos?.position ?? -1) + 1,
          dishType: "food",
          isActive: true,
        },
      });
      importCategoryId = created.id;
    }
  }

  let mapped = 0, created = 0, skipped = 0;

  for (const a of actions) {
    if (a.action === "skip") { skipped++; continue; }

    if (a.action === "map" && a.dishId) {
      // Mapeo: NO sobrescribimos nada del Dish, solo el toteatProductId
      await prisma.dish.update({
        where: { id: a.dishId },
        data: {
          toteatProductId: a.toteatId,
          toteatMappedAt: new Date(),
          toteatMappedBy: "manual",
        },
      });
      mapped++;
      continue;
    }

    if (a.action === "create" && importCategoryId) {
      const lastDishPos = await prisma.dish.findFirst({ where: { categoryId: importCategoryId }, orderBy: { position: "desc" }, select: { position: true } });
      await prisma.dish.create({
        data: {
          restaurantId,
          categoryId: importCategoryId,
          name: a.name || "Sin nombre",
          price: typeof a.price === "number" ? a.price : 0,
          photos: [],
          position: (lastDishPos?.position ?? -1) + 1,
          isActive: true,
          toteatProductId: a.toteatId,
          toteatMappedAt: new Date(),
          toteatMappedBy: "auto",
          toteatSynced: true,
        },
      });
      created++;
    }
  }

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { toteatImportDone: true },
  });

  return NextResponse.json({ ok: true, summary: { mapped, created, skipped } });
}
