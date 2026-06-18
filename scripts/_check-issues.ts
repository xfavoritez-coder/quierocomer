import { config } from 'dotenv'; config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL });
async function main() {
  // 1. Coca products sin categoria
  const coca = await prisma.dish.findMany({
    where: { name: { contains: 'coca', mode: 'insensitive' }, isActive: true, deletedAt: null },
    select: { id: true, name: true, restaurant: { select: { name: true } }, category: { select: { name: true, dishType: true } } },
    take: 10,
  });
  console.log('COCA:', JSON.stringify(coca.map(d => ({ name: d.name, rest: d.restaurant.name, cat: d.category.name, type: d.category.dishType })), null, 2));

  // 2. Krua Thai spring rolls
  const kt = await prisma.dish.findMany({
    where: { restaurant: { slug: 'krua-thai' }, isActive: true, deletedAt: null },
    select: { id: true, name: true, txDishType: true, category: { select: { name: true, dishType: true } }, leafOverride: true },
    orderBy: { name: 'asc' },
  });
  console.log('\nKRUA THAI:', JSON.stringify(kt.map(d => ({ name: d.name, cat: d.category.name, leafOverride: d.leafOverride, tx: d.txDishType })), null, 2));

  // 3. Sushinikkei17
  const sn = await prisma.restaurant.findFirst({
    where: { slug: 'sushinikkei17' },
    select: { id: true, name: true }
  });
  const snCats = await prisma.category.findMany({ where: { restaurantId: sn!.id }, select: { name: true, dishes: { select: { name: true, photos: true }, take: 3 } }, take: 5 });
  console.log('\nSUSHINIKKEI17 id:', sn?.id);
  console.log('categories:', JSON.stringify(snCats.map(c => ({ cat: c.name, sample: c.dishes.map(d => ({ name: d.name, hasPhoto: d.photos.length > 0, photoUrl: d.photos[0]?.substring(0,80) })) })), null, 2));

  await prisma.$disconnect();
}
main().catch(console.error);
