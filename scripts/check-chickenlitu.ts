import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

async function main() {
  const leads = await p.lead.findMany({
    where: {
      OR: [
        { localName: { contains: 'chicken', mode: 'insensitive' } },
        { localName: { contains: 'litu', mode: 'insensitive' } },
        { localName: { contains: 'chickenlitu', mode: 'insensitive' } },
      ],
    },
    include: {
      detectedProvider: true,
      whatsappMessages: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  });

  if (leads.length === 0) {
    console.log('No leads found matching CHICKEN or LITU');
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
    console.log('Carta File URL:', lead.cartaFileUrl);
    console.log('Carta Status:', lead.cartaStatus);
    console.log('Error Log:', lead.errorLog);
    console.log('Generated Slug:', lead.generatedSlug);
    console.log('Activated:', lead.activated);
    console.log('Converted To Owner:', lead.convertedToOwnerId);
    console.log('Preview:', JSON.stringify(lead.preview));
    console.log('Step2 At:', lead.step2At);
    console.log('Completed At:', lead.completedAt);
    console.log('Preview At:', lead.previewAt);
    console.log('Ready At:', lead.readyAt);
    console.log('Delivered At:', lead.deliveredAt);
    console.log('Email Opened:', lead.emailOpenedAt);
    console.log('Email Clicked:', lead.emailClickedAt);
    console.log('WA Sent:', lead.whatsappSentAt);
    console.log('WA Opened:', lead.whatsappOpenedAt);
    console.log('WA Clicked:', lead.whatsappClickedAt);
    console.log('Opened Via:', lead.openedVia);
    console.log('Onboarding Done:', lead.onboardingDoneAt);
    console.log('Panel Visited:', lead.panelVisitedAt);
    console.log('Activar Visited:', lead.activarVisitedAt);
    console.log('Activated At:', lead.activatedAt);
    console.log('IP:', lead.ip);
    console.log('City:', lead.city);
    console.log('Created:', lead.createdAt);
    console.log('Updated:', lead.updatedAt);

    if (lead.detectedProvider) {
      console.log('\n--- Provider ---');
      console.log('Provider:', lead.detectedProvider.name, lead.detectedProvider.id);
    }

    console.log('\n--- Events ---');
    const events = lead.events as any[];
    for (const ev of events) {
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
