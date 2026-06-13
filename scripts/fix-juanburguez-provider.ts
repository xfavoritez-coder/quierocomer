import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const p = new PrismaClient();

async function main() {
  // Create Influye as a known provider
  const influye = await p.menuProvider.create({
    data: {
      name: 'Influye',
      domainPatterns: ['influye.app'],
      htmlSignatures: ['influye.app', 'VIRTUAL_MENU', 'var data = {'],
      status: 'SUPPORTED',
      extractionConfig: { useJina: true },
      notes: 'Plataforma de menú virtual chilena (influye.app). Sirve SPAs desde dominios custom. El menú está en un <script>var data={...}</script>. Requiere Jina para renderizar.',
      successCount: 0,
      failCount: 0,
    },
  });
  console.log('Created Influye provider:', influye.id);

  // Update Juan Burguez lead to point to Influye
  const lead = await p.lead.findFirst({
    where: { localName: { contains: 'Juan burgu', mode: 'insensitive' } },
  });
  if (lead) {
    await p.lead.update({
      where: { id: lead.id },
      data: { detectedProviderId: influye.id },
    });
    console.log('Updated lead to use Influye provider');
  }

  // Delete the auto-created Juanburguez provider
  await p.menuProvider.deleteMany({
    where: { name: 'Juanburguez' },
  });
  console.log('Deleted old Juanburguez provider');

  await p.$disconnect();
}
main();
