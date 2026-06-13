import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const lead = await prisma.lead.findUnique({
    where: { id: 'cmplgjf07007olb04fca6f1mc' },
    select: { id: true, localName: true, cartaStatus: true, errorLog: true, generatedSlug: true, preview: true },
  });
  console.log(JSON.stringify(lead, null, 2));
}

main().finally(() => prisma.$disconnect());
