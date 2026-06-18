import { config } from 'dotenv'; config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL });
async function main() {
  // Clear expired lh3 photos — only those that still have lh3 URLs (not updated ones)
  const dishes = await prisma.dish.findMany({
    where: { restaurantId: 'cmqj1gs2p0000jx041joo6beg', isActive: true, deletedAt: null },
    select: { id: true, photos: true },
  });
  const stale = dishes.filter(d => {
    const p = (d.photos as string[])[0];
    return p && p.includes('lh3.googleusercontent.com');
  });
  console.log(`Clearing ${stale.length} dishes with stale lh3 photos...`);
  for (const d of stale) {
    await prisma.dish.update({ where: { id: d.id }, data: { photos: [] } });
  }
  console.log('Done');
  await prisma.$disconnect();
}
main().catch(console.error);
