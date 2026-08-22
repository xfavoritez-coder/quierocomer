import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const r = await p.restaurant.findFirst({
    where: { id: 'cmsgbn89k001fjp04ljaw6s1n' },
    select: {
      id: true, name: true, slug: true,
      subscriptionStatus: true, trialEndsAt: true, currentPeriodEnd: true,
      loyaltyStatus: true, loyaltyPeriodEnd: true,
      defaultView: true, cartaProvider: true, cartaAccentColor: true,
      orderingEnabled: true, orderingPhone: true, orderingDelivery: true,
      orderingMode: true, orderingTheme: true,
      isDemo: true, isShowcase: true,
      showCategoryLobby: true, multiMenuEnabled: true, filterBarEnabled: true,
      genioFabEnabled: true, menuImported: true,
      whatsapp: true, phone: true,
    }
  });
  console.log('Restaurant:', JSON.stringify(r, null, 2));

  const cats = await p.category.findMany({
    where: { restaurantId: 'cmsgbn89k001fjp04ljaw6s1n', isActive: true },
    select: { id: true, name: true, position: true }
  });
  console.log('\nActive categories:', cats.length);
  cats.forEach(c => console.log(`  ${c.position}. ${c.name}`));

  const dishCount = await p.dish.count({
    where: { restaurantId: 'cmsgbn89k001fjp04ljaw6s1n', isActive: true, deletedAt: null }
  });
  console.log('\nActive dishes:', dishCount);

  await p.$disconnect();
}
main();
