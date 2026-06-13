import { config } from 'dotenv';
config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

async function main() {
  const lead = await p.lead.findFirst({
    where: { localName: { contains: 'iscel', mode: 'insensitive' } },
    select: { id: true, localName: true, cartaStatus: true, errorLog: true, updatedAt: true },
    orderBy: { createdAt: 'desc' },
  });
  console.log(JSON.stringify(lead, null, 2));
  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
