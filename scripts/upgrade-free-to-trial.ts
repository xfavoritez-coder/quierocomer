import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const p = new PrismaClient();

async function main() {
  // Find all FREE restaurants that are not demo and don't already have a trial
  const freeRestaurants = await p.restaurant.findMany({
    where: {
      plan: 'FREE',
      isDemo: false,
      trialEndsAt: null,
    },
    select: { id: true, name: true, slug: true, subscriptionStatus: true, trialEndsAt: true },
  });

  console.log(`Found ${freeRestaurants.length} FREE restaurants without trial:`);
  for (const r of freeRestaurants) {
    console.log(`  ${r.name} (${r.slug}) | status: ${r.subscriptionStatus}`);
  }

  if (freeRestaurants.length === 0) {
    console.log('Nothing to update.');
    await p.$disconnect();
    return;
  }

  // Give them 14 days of premium trial
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);

  const result = await p.restaurant.updateMany({
    where: {
      plan: 'FREE',
      isDemo: false,
      trialEndsAt: null,
    },
    data: {
      plan: 'PREMIUM',
      subscriptionStatus: 'TRIALING',
      trialEndsAt,
    },
  });

  console.log(`\nUpdated ${result.count} restaurants to PREMIUM trial (ends ${trialEndsAt.toISOString()})`);
  await p.$disconnect();
}
main();
