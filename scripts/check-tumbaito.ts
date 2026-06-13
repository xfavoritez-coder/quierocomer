import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const p = new PrismaClient();

async function main() {
  const lead = await p.lead.findFirst({
    where: { localName: { contains: 'tumbaito', mode: 'insensitive' } },
  });
  if (!lead) { console.log('Not found'); return; }

  console.log('onboardingDoneAt:', lead.onboardingDoneAt);
  console.log('cartaStatus:', lead.cartaStatus);
  console.log('activated:', lead.activated);
  console.log('activatedAt:', lead.activatedAt);
  console.log('generatedSlug:', lead.generatedSlug);
  console.log('convertedToOwnerId:', lead.convertedToOwnerId);
  console.log('');

  const events = (lead.events as any[]) || [];
  const onboardEvents = events.filter((e: any) => e.action?.startsWith('onboard'));
  console.log('Onboard events:');
  for (const e of onboardEvents) {
    console.log(' ', JSON.stringify(e));
  }

  // Check if restaurant exists
  if (lead.generatedSlug) {
    const rest = await p.restaurant.findFirst({
      where: { slug: lead.generatedSlug },
      select: { id: true, name: true, plan: true, isDemo: true, subscriptionStatus: true, trialEndsAt: true },
    });
    console.log('\nRestaurant:', JSON.stringify(rest, null, 2));
  }

  await p.$disconnect();
}
main();
