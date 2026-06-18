import { prisma } from '../src/lib/prisma';

const r = await prisma.restaurant.findFirst({
  where: { name: { contains: 'mpanadazo', mode: 'insensitive' } },
  select: { id: true, name: true, slug: true },
});
console.log(JSON.stringify(r));
await prisma.$disconnect();
