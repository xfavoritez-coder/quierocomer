import { PrismaClient } from '@prisma/client';
import { translateAllForRestaurant } from '../src/lib/ai/translateContent';

const prisma = new PrismaClient();

const slugs = ['hand-roll', 'alleria-delivery', 'alleria-pizza', 'el-menu-de-la-esquina', 'nascosto-pizzeria'];

async function main() {
  const rests = await prisma.restaurant.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, name: true, slug: true }
  });

  for (const r of rests) {
    console.log(`\nTraduciendo ${r.name} (${r.slug})...`);
    try {
      const result = await translateAllForRestaurant(r.id);
      await prisma.restaurant.update({ where: { id: r.id }, data: { needsTranslation: false } });
      console.log(`  ✓ ${result.dishes} platos, ${result.categories} categorías`);
    } catch (e: any) {
      console.error(`  ✗ Error: ${e.message}`);
    }
  }

  await prisma.$disconnect();
}

main();
