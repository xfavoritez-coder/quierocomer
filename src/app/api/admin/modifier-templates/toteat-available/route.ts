import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, getOwnedRestaurantIds, isSuperAdmin } from "@/lib/adminAuth";
import { loadCredentialsFromRestaurant } from "@/lib/toteat/sync";
import { fetchToteatProducts } from "@/lib/toteat/fetchProducts";

/**
 * GET /api/admin/modifier-templates/toteat-available?restaurantId=...
 *
 * Devuelve los modificadores de Toteat (productos con isModifier=true) que
 * AUN no estan asignados a ningun ModifierTemplateOption del restaurant.
 * Sirve para el picker "+ Importar opciones desde Toteat" dentro del editor
 * de modificadores: el dueno arma sus grupos en QC y desde ahi va eligiendo
 * de la lista cuales agregar.
 */
export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  if (!isSuperAdmin(req)) {
    const ownedIds = await getOwnedRestaurantIds(req);
    if (!ownedIds || !ownedIds.includes(restaurantId)) {
      return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
    }
  }

  const credentials = await loadCredentialsFromRestaurant(restaurantId, false);
  if (!credentials) return NextResponse.json({ items: [], reason: "no-credentials" });

  // Catalogo Toteat (incluye modificadores)
  const resp = await fetchToteatProducts({ credentials, activeOnly: true });
  if (resp.ok === false || !resp.data) {
    return NextResponse.json({ items: [], reason: "toteat-error" });
  }

  // Solo los marcados como modificadores
  const toteatModifiers = resp.data.filter((p) => p.isModifier);

  // toteatProductIds ya asignados a algun ModifierTemplateOption del restaurant
  const usedOptions = await prisma.modifierTemplateOption.findMany({
    where: {
      group: { template: { restaurantId } },
      toteatProductId: { not: null },
    },
    select: { toteatProductId: true },
  });
  const usedIds = new Set(usedOptions.map((o) => o.toteatProductId!).filter(Boolean));

  const available = toteatModifiers
    .filter((m) => !usedIds.has(m.id))
    .map((m) => ({
      toteatId: m.id,
      name: m.name,
      price: m.price,
      category: m.category,
    }))
    .sort((a, b) => {
      const ca = (a.category || "").localeCompare(b.category || "", "es");
      if (ca !== 0) return ca;
      return a.name.localeCompare(b.name, "es");
    });

  return NextResponse.json({
    items: available,
    summary: {
      totalToteatModifiers: toteatModifiers.length,
      alreadyAssigned: usedIds.size,
      available: available.length,
    },
  });
}
