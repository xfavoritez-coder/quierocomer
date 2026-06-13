import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const p = new PrismaClient();

async function main() {
  // Restaurants that came from subircarta have a website field set
  // Also, restaurants with a matching lead (generatedSlug) that went through the pipeline
  const withWebsite = await p.restaurant.updateMany({
    where: { website: { not: null }, menuImported: false },
    data: { menuImported: true },
  });
  console.log(`Marked ${withWebsite.count} restaurants with website as menuImported`);

  // Also mark restaurants that have a matching lead with cartaStatus READY or DELIVERED
  const leads = await p.lead.findMany({
    where: { generatedSlug: { not: null }, cartaStatus: { in: ['READY', 'DELIVERED'] } },
    select: { generatedSlug: true },
  });
  const slugs = leads.map(l => l.generatedSlug!).filter(Boolean);
  if (slugs.length > 0) {
    const fromLeads = await p.restaurant.updateMany({
      where: { slug: { in: slugs }, menuImported: false },
      data: { menuImported: true },
    });
    console.log(`Marked ${fromLeads.count} restaurants from leads as menuImported`);
  }

  await p.$disconnect();
}
main();
