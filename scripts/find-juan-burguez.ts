import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

async function main() {
  // Search broadly for anything matching
  const leads = await p.lead.findMany({
    where: {
      OR: [
        { localName: { contains: 'burg', mode: 'insensitive' } },
        { localName: { contains: 'juan', mode: 'insensitive' } },
        { ownerName: { contains: 'juan', mode: 'insensitive' } },
      ],
    },
    include: {
      detectedProvider: true,
      whatsappMessages: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  });

  if (leads.length === 0) {
    console.log('No leads found. Checking recent FAILED leads...');
    const failed = await p.lead.findMany({
      where: {
        cartaStatus: 'FAILED',
        createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      },
      select: { id: true, localName: true, ownerName: true, errorLog: true, cartaUrl: true, createdAt: true, cartaStatus: true },
      orderBy: { createdAt: 'desc' },
    });
    console.log(`Found ${failed.length} recent failed leads:`);
    for (const l of failed) {
      console.log(`  ${l.localName} | ${l.ownerName} | ${l.cartaStatus} | ${l.errorLog?.substring(0, 80)} | ${l.createdAt}`);
    }
    await p.$disconnect();
    return;
  }

  for (const lead of leads) {
    console.log('=== LEAD ===');
    console.log('ID:', lead.id);
    console.log('Local Name:', lead.localName);
    console.log('Owner Name:', lead.ownerName);
    console.log('Email:', lead.email);
    console.log('WhatsApp:', lead.whatsapp);
    console.log('Carta Type:', lead.cartaType);
    console.log('Carta URL:', lead.cartaUrl);
    console.log('Carta Status:', lead.cartaStatus);
    console.log('Error Log:', lead.errorLog);
    console.log('Generated Slug:', lead.generatedSlug);
    console.log('Provider:', lead.detectedProvider?.name);
    console.log('Preview:', JSON.stringify(lead.preview));
    console.log('Created:', lead.createdAt);
    console.log('\n--- Events ---');
    for (const ev of (lead.events as any[] || [])) {
      console.log(`  ${JSON.stringify(ev).substring(0, 300)}`);
    }
    console.log('\n--- WA Messages ---');
    for (const msg of lead.whatsappMessages) {
      console.log(`  ${msg.createdAt} | ${msg.direction} | ${msg.templateName || msg.body?.substring(0, 100)}`);
    }
    console.log('');
  }

  await p.$disconnect();
}

main();
