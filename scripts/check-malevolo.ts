import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const p = new PrismaClient();

async function main() {
  const rest = await p.restaurant.findFirst({
    where: { name: { contains: 'malevolo', mode: 'insensitive' } },
    select: { id: true, name: true, slug: true, plan: true, subscriptionStatus: true, trialEndsAt: true, isDemo: true, createdAt: true, ownerId: true,
      owner: { select: { name: true, email: true, whatsapp: true, lastLoginAt: true } } },
  });
  console.log('Restaurant:', JSON.stringify(rest, null, 2));

  if (rest?.slug) {
    const lead = await p.lead.findFirst({
      where: { generatedSlug: rest.slug },
      select: { id: true, localName: true, email: true, cartaStatus: true, generatedSlug: true, activated: true, activatedAt: true, events: true,
        deliveredAt: true, emailOpenedAt: true, emailClickedAt: true, onboardingDoneAt: true, panelVisitedAt: true },
    });
    console.log('Lead:', JSON.stringify(lead, null, 2));
  }

  if (rest?.owner?.email) {
    const emails = await p.emailLog.findMany({
      where: { to: rest.owner.email },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    console.log('Email logs:', JSON.stringify(emails, null, 2));
  }

  // Check panelActivity
  if (rest?.id) {
    const activity = await p.panelActivity.findMany({
      where: { restaurantId: rest.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    console.log('Panel activity:', JSON.stringify(activity, null, 2));
  }

  await p.$disconnect();
}
main();
