import { config } from 'dotenv'; config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL });
async function main() {
  // Find single-word "Coca" dishes
  const coca = await prisma.dish.findMany({
    where: { name: { equals: 'Coca', mode: 'insensitive' }, isActive: true, deletedAt: null },
    select: { id: true, name: true, restaurant: { select: { name: true, slug: true } }, category: { select: { id: true, name: true, dishType: true } } },
  });
  console.log('Exact "Coca":', JSON.stringify(coca, null, 2));
  await prisma.$disconnect();
}
main().catch(console.error);
