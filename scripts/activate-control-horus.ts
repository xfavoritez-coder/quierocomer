/**
 * Activa el módulo Control para Horus Vegan.
 * Usage: npx tsx scripts/activate-control-horus.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const restaurant = await prisma.restaurant.update({
    where: { slug: "horusvegan" },
    data: { controlEnabled: true },
    select: { id: true, name: true, controlEnabled: true },
  });
  console.log(`✅ Control habilitado para: ${restaurant.name} (${restaurant.id})`);
  console.log(`   controlEnabled: ${restaurant.controlEnabled}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
