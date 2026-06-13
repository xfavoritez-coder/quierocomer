import { config } from 'dotenv';
config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

async function main() {
  const leads = await p.lead.findMany({
    where: { localName: { contains: 'iscel', mode: 'insensitive' } },
    select: { id: true, localName: true, cartaUrl: true, cartaStatus: true, errorLog: true, detectedProvider: true },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });
  console.log(JSON.stringify(leads, null, 2));
  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
