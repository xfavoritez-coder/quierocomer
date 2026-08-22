import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const r = await p.restaurant.findFirst({
    where: { name: { contains: 'avenida', mode: 'insensitive' } },
    select: { id: true, name: true, slug: true, plan: true, loyaltyStatus: true, loyaltyPeriodEnd: true, isActive: true, defaultView: true, cartaColorMode: true }
  });
  console.log('Restaurant:', JSON.stringify(r, null, 2));

  // Also check if loyalty program exists
  if (r) {
    const loyalty = await p.loyaltyProgram.findFirst({
      where: { restaurantId: r.id },
      select: { id: true, active: true, stampGoal: true, rewards: true, name: true }
    });
    console.log('Loyalty:', JSON.stringify(loyalty, null, 2));
  }

  await p.$disconnect();
}
main();
