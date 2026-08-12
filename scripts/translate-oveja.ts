import { PrismaClient } from '@prisma/client';
import { translateAllForRestaurant } from '../src/lib/ai/translateContent';

const prisma = new PrismaClient();

async function main() {
  const r = await prisma.restaurant.findUnique({
    where: { slug: 'la-oveja-negra-restaurante' },
    select: { id: true, name: true }
  });
  if (!r) { console.log('No encontrado'); return; }
  console.log(`Traduciendo ${r.name}...`);
  const result = await translateAllForRestaurant(r.id);
  await prisma.restaurant.update({ where: { id: r.id }, data: { needsTranslation: false } });
  console.log(`✓ ${result.dishes} platos, ${result.categories} categorías`);
  await prisma.$disconnect();
}

main();
