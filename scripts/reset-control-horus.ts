/**
 * Reinicia el módulo Control de Horus Vegan desde cero.
 * Borra todos los insumos del restaurante (el wizard puede volver a correr).
 * Usage: npx tsx scripts/reset-control-horus.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: "horusvegan" },
    select: { id: true, name: true },
  });
  if (!restaurant) { console.error("❌ No se encontró horusvegan"); return; }

  const deleted = await prisma.insumo.deleteMany({
    where: { restaurantId: restaurant.id },
  });

  console.log(`✅ Reiniciado Control de ${restaurant.name}: ${deleted.count} insumos eliminados`);
  console.log(`   El wizard corre de nuevo desde /panel/control`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
