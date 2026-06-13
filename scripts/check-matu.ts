import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const p = new PrismaClient();

async function main() {
  const owner = await p.restaurantOwner.findFirst({
    where: { email: { contains: 'juanmatura', mode: 'insensitive' } },
    include: { restaurants: { select: { id: true, name: true, slug: true, plan: true, isDemo: true, subscriptionStatus: true, trialEndsAt: true, createdAt: true } } },
  });
  console.log('Owner:', JSON.stringify(owner, null, 2));

  const lead = await p.lead.findFirst({
    where: { OR: [
      { email: { contains: 'juanmatura', mode: 'insensitive' } },
      { localName: { contains: 'matu', mode: 'insensitive' } },
      { ownerName: { contains: 'matu', mode: 'insensitive' } },
    ]},
    select: { id: true, localName: true, ownerName: true, email: true, cartaStatus: true, generatedSlug: true, activated: true, activatedAt: true, events: true },
  });
  console.log('Lead:', JSON.stringify(lead, null, 2));

  const emails = await p.emailLog.findMany({
    where: { to: { contains: 'juanmatura', mode: 'insensitive' } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  console.log('Email logs:', JSON.stringify(emails, null, 2));

  await p.$disconnect();
}
main();
