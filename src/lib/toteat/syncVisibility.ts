/**
 * Sync visibility de productos: lee el catalogo COMPLETO de Toteat (incluyendo
 * inactivos) y actualiza el campo Dish.toteatHidden para reflejar el estado
 * del POS. No crea ni borra platos, solo cambia visibilidad.
 *
 * - Si un plato QC mapeado a Toteat ya no aparece en el catalogo activo
 *   (fue desactivado en Toteat), marcamos toteatHidden=true.
 * - Si vuelve a aparecer, toteatHidden=false.
 * - Platos sin toteatProductId no se tocan.
 */
import { prisma } from "@/lib/prisma";
import { fetchToteatProducts } from "./fetchProducts";
import { ToteatCredentials } from "./fetchSales";

export interface VisibilitySyncResult {
  restaurantId: string;
  ok: boolean;
  hidden: number;     // platos que ahora estan ocultos
  shown: number;      // platos que volvieron a estar visibles
  unchanged: number;  // platos sin cambios
  error?: string;
}

export async function syncRestaurantVisibility(opts: {
  restaurantId: string;
  credentials: ToteatCredentials;
}): Promise<VisibilitySyncResult> {
  const out: VisibilitySyncResult = {
    restaurantId: opts.restaurantId,
    ok: false,
    hidden: 0,
    shown: 0,
    unchanged: 0,
  };

  // Catalogo activo de Toteat (solo productos visibles)
  const respActive = await fetchToteatProducts({ credentials: opts.credentials, activeOnly: true });
  if (respActive.ok === false || !respActive.data) {
    out.error = typeof respActive.msg === "string" ? respActive.msg : respActive.msg?.texto || "Toteat error";
    return out;
  }
  const activeIds = new Set(respActive.data.map((p) => p.id));

  // Platos QC con toteatProductId
  const dishes = await prisma.dish.findMany({
    where: { restaurantId: opts.restaurantId, toteatProductId: { not: null }, deletedAt: null },
    select: { id: true, toteatProductId: true, toteatHidden: true },
  });

  for (const d of dishes) {
    const shouldBeHidden = !activeIds.has(d.toteatProductId!);
    if (shouldBeHidden === d.toteatHidden) {
      out.unchanged++;
      continue;
    }
    await prisma.dish.update({
      where: { id: d.id },
      data: { toteatHidden: shouldBeHidden },
    });
    if (shouldBeHidden) out.hidden++;
    else out.shown++;
  }

  await prisma.restaurant.update({
    where: { id: opts.restaurantId },
    data: { toteatLastVisibilitySyncAt: new Date() },
  });

  out.ok = true;
  return out;
}
