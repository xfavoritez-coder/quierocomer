import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();

async function main() {
  const lead = await prisma.lead.findFirst({
    where: { localName: { contains: 'Juan burgu', mode: 'insensitive' } },
  });

  if (!lead) {
    console.log('Lead not found');
    process.exit(1);
  }

  console.log('Found lead:', lead.id, lead.localName, lead.cartaStatus);

  // Reset to PENDING
  const events = (lead.events as any[]) || [];
  events.push({ ts: new Date().toISOString(), action: 'manual_reprocess', reason: 'gastronomy check fix' });

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      cartaStatus: 'PENDING',
      errorLog: null,
      events: events as any,
    },
  });

  console.log('Lead reset to PENDING. Triggering reprocess...');

  // Trigger processing via API
  const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://quierocomer.cl';
  const res = await fetch(`${BASE}/api/subircarta/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leadId: lead.id }),
  });

  console.log('Process response:', res.status, await res.text());
  await prisma.$disconnect();
}

main();
