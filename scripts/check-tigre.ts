import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const r = await p.restaurant.findFirst({
    where: { slug: 'amila-cafeteria' },
    select: { id: true, name: true, isDemo: true, plan: true, _count: { select: { dishes: true } } },
  });
  console.log('Amila:', JSON.stringify(r, null, 2));
}

main().finally(() => p.$disconnect());
