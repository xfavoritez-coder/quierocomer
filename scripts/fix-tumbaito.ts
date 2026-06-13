import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const p = new PrismaClient();

async function main() {
  const rest = await p.restaurant.findFirst({
    where: { slug: 'el-tumbaito' },
    select: { demoOnboardingDone: true, slug: true },
  });
  console.log('Restaurant demoOnboardingDone:', rest?.demoOnboardingDone);

  const result = await p.lead.updateMany({
    where: { generatedSlug: 'el-tumbaito', onboardingDoneAt: null },
    data: { onboardingDoneAt: new Date() },
  });
  console.log('Fixed leads:', result.count);
  await p.$disconnect();
}
main();
