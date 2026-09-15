import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, getOwnedRestaurantIds, isSuperAdmin } from "@/lib/adminAuth";
import { loadCredentialsFromRestaurant } from "@/lib/toteat/sync";
import { fetchToteatProducts } from "@/lib/toteat/fetchProducts";
import { norm } from "@/lib/normalize";

/**
 * POST /api/admin/toteat/import-preview
 * Body: { restaurantId }
 *
 * Retorna un plan de import:
 * - items[]: por cada producto en Toteat, sugerencia de accion
 *   - "already-mapped": el producto ya esta mapeado a un Dish QC
 *   - "match-found": hay un Dish QC con nombre similar (sugerencia de mapeo)
 *   - "new": no hay match, sugerencia de crear nuevo
 * - qcOnly[]: dishes en QC que NO tienen contraparte en Toteat
 */
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }
  const restaurantId = body?.restaurantId as string | undefined;
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  if (!isSuperAdmin(req)) {
    const ownedIds = await getOwnedRestaurantIds(req);
    if (!ownedIds || !ownedIds.includes(restaurantId)) {
      return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
    }
  }

  const credentials = await loadCredentialsFromRestaurant(restaurantId, false);
  if (!credentials) return NextResponse.json({ error: "Sin credenciales Toteat" }, { status: 400 });

  // Catalogo activo de Toteat
  const resp = await fetchToteatProducts({ credentials, activeOnly: true });
  if (resp.ok === false || !resp.data) {
    return NextResponse.json({ error: typeof resp.msg === "string" ? resp.msg : resp.msg?.texto || "Toteat error" }, { status: 502 });
  }

  // Solo productos no-modificadores: los modificadores se manejan aparte
  const products = resp.data.filter((p) => !p.isModifier);

  // Dishes QC del restaurant
  const dishes = await prisma.dish.findMany({
    where: { restaurantId, deletedAt: null },
    select: { id: true, name: true, price: true, toteatProductId: true },
  });

  // Index por toteatProductId
  const byToteatId = new Map<string, typeof dishes[number]>();
  for (const d of dishes) if (d.toteatProductId) byToteatId.set(d.toteatProductId, d);

  // Index por nombre normalizado para fuzzy match
  const byNormName = new Map<string, typeof dishes[number][]>();
  for (const d of dishes) {
    const key = norm(d.name);
    const arr = byNormName.get(key) || [];
    arr.push(d);
    byNormName.set(key, arr);
  }

  type ImportItem = {
    toteatId: string;
    toteatName: string;
    toteatPrice: number;
    toteatCategory: string | null;
    action: "already-mapped" | "match-found" | "new";
    suggestedDishId: string | null;
    suggestedDishName: string | null;
  };

  const items: ImportItem[] = products.map((p) => {
    // 1) Ya mapeado
    if (byToteatId.has(p.id)) {
      const d = byToteatId.get(p.id)!;
      return {
        toteatId: p.id, toteatName: p.name, toteatPrice: p.price, toteatCategory: p.category,
        action: "already-mapped", suggestedDishId: d.id, suggestedDishName: d.name,
      };
    }
    // 2) Match por nombre normalizado
    const matches = byNormName.get(norm(p.name)) || [];
    const unmappedMatch = matches.find((d) => !d.toteatProductId);
    if (unmappedMatch) {
      return {
        toteatId: p.id, toteatName: p.name, toteatPrice: p.price, toteatCategory: p.category,
        action: "match-found", suggestedDishId: unmappedMatch.id, suggestedDishName: unmappedMatch.name,
      };
    }
    // 3) Nuevo
    return {
      toteatId: p.id, toteatName: p.name, toteatPrice: p.price, toteatCategory: p.category,
      action: "new", suggestedDishId: null, suggestedDishName: null,
    };
  });

  // Dishes QC que no tienen toteatProductId y no aparecen en el catalogo de Toteat
  const matchedDishIds = new Set(items.filter((i) => i.suggestedDishId).map((i) => i.suggestedDishId!));
  const qcOnly = dishes
    .filter((d) => !d.toteatProductId && !matchedDishIds.has(d.id))
    .map((d) => ({ id: d.id, name: d.name }));

  return NextResponse.json({
    summary: {
      toteatTotal: products.length,
      alreadyMapped: items.filter((i) => i.action === "already-mapped").length,
      matchFound: items.filter((i) => i.action === "match-found").length,
      newToCreate: items.filter((i) => i.action === "new").length,
      qcOnly: qcOnly.length,
    },
    items,
    qcOnly,
  });
}
