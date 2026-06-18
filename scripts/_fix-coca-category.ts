import { config } from 'dotenv'; config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL });
async function main() {
  // Fix "LIMONADAS VARIEDADES" at sushinikkei17 to be dishType=drink
  const cat = await prisma.category.updateMany({
    where: { name: 'LIMONADAS VARIEDADES', restaurantId: 'cmqj1gs2p0000jx041joo6beg' },
    data: { dishType: 'drink' }
  });
  console.log('Updated categories:', cat.count);
  
  // Also fix "Coca cola" in Barrakuda (in "Churrascos" which is food — wrong)
  // These should be hidden from feed since they're drinks, but category name is wrong
  // The simplest fix: set hiddenFromFeed = true on them
  const barrakudaCoca = await prisma.dish.updateMany({
    where: {
      restaurant: { slug: 'barrakuda' },
      name: { in: ['Coca cola', 'Coca cola sin azúcar'] },
      isActive: true,
    },
    data: { hiddenFromFeed: true }
  });
  console.log('Barrakuda coca hidden:', barrakudaCoca.count);
  
  await prisma.$disconnect();
}
main().catch(console.error);
