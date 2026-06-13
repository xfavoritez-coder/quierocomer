import { config } from 'dotenv';
config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

async function main() {
  const lead = await p.lead.findFirst({
    where: { localName: { contains: 'iscel', mode: 'insensitive' } },
    select: { id: true, localName: true, cartaStatus: true },
    orderBy: { createdAt: 'desc' },
  });

  if (!lead) { console.log('No lead found'); return; }

  console.log('Resetting:', lead.localName, lead.cartaStatus);

  await p.lead.update({
    where: { id: lead.id },
    data: { cartaStatus: 'PENDING', errorLog: null },
  });

  console.log('Reset to PENDING — will be picked up by pipeline on next trigger');
  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
