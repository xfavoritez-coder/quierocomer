/**
 * Fix: activar hideOriginalWhenActive en las promos de Kojo que tienen linkedDish
 * apuntando a un plato original (Deluxe y Martes de Suprema).
 * Miércoles Mix no necesita fix porque dishIds está vacío (no hay original que ocultar).
 */
import { config } from "dotenv";
config({ path: ".env.prod" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const KOJO_IDS = ["cmubc0yoq0001jv041si8zicn", "cmvcjbx090001jn074i0eg9zu"];

async function main() {
  // Buscar todas las promos activas de Kojo que tienen linkedDish Y dishIds no vacío
  const promos = await prisma.promotion.findMany({
    where: {
      restaurantId: { in: KOJO_IDS },
      status: "ACTIVE",
      linkedDishId: { not: null },
    },
    select: { id: true, name: true, restaurantId: true, dishIds: true, hideOriginalWhenActive: true, linkedDishId: true, daysOfWeek: true },
  });

  console.log(`\nPromos encontradas: ${promos.length}`);
  for (const p of promos) {
    console.log(`  [${p.id}] "${p.name}" | dishIds: ${p.dishIds.length} | hideOriginal: ${p.hideOriginalWhenActive} | days: [${p.daysOfWeek}]`);
  }

  // Solo actualizar las que tienen dishIds (hay un original que ocultar) y aún no tienen hideOriginalWhenActive
  const toFix = promos.filter((p) => p.dishIds.length > 0 && !p.hideOriginalWhenActive);
  if (!toFix.length) {
    console.log("\n✅ Todas las promos ya tienen hideOriginalWhenActive=true. Nada que hacer.");
  } else {
    console.log(`\nActualizando ${toFix.length} promo(s)...`);
    for (const p of toFix) {
      await prisma.promotion.update({ where: { id: p.id }, data: { hideOriginalWhenActive: true } });
      console.log(`  ✓ "${p.name}" → hideOriginalWhenActive=true`);
    }
  }

  // Correr sync para aplicar el estado inmediatamente
  console.log("\nSincronizando...");
  const { syncPromoStoreProductsActive } = await import("../src/lib/promos/promoStoreProduct");
  const { syncRestaurantDishDiscounts } = await import("../src/lib/promos/syncDishDiscounts");

  for (const rId of KOJO_IDS) {
    // Recopilar todos los dishIds de promos de este local
    const rPromos = promos.filter((p) => p.restaurantId === rId);
    const dishIds = [...new Set(rPromos.flatMap((p) => p.dishIds))];
    if (dishIds.length) await syncRestaurantDishDiscounts(rId, dishIds);
    await syncPromoStoreProductsActive(rId);
    console.log(`  ✓ sync ${rId}`);
  }

  // Verificar estado final
  console.log("\n── Estado final ──");
  const result = await prisma.promotion.findMany({
    where: { restaurantId: { in: KOJO_IDS }, status: "ACTIVE", linkedDishId: { not: null } },
    select: { name: true, dishIds: true, hideOriginalWhenActive: true, daysOfWeek: true, linkedDishId: true },
  });
  for (const p of result) {
    const linked = p.linkedDishId
      ? await prisma.dish.findUnique({ where: { id: p.linkedDishId }, select: { name: true, isActive: true } })
      : null;
    console.log(`  "${p.name}" | hideOriginal: ${p.hideOriginalWhenActive} | linkedDish: "${linked?.name}" isActive=${linked?.isActive}`);
  }

  // Verificar que los platos originales están ocultos HOY si la promo está activa
  const cl = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }));
  const today = cl.getDay();
  console.log(`\nDía de hoy (Chile): ${["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"][today]} (${today})`);

  console.log("\n✅ Listo");
}

main().catch(console.error).finally(() => prisma.$disconnect());
