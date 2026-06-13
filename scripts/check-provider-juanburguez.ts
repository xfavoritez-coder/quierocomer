import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const prov = await p.menuProvider.findMany({
    where: { name: { contains: 'uan', mode: 'insensitive' } },
  });
  console.log('Juanburguez provider:', JSON.stringify(prov, null, 2));

  const influye = await p.menuProvider.findMany({
    where: { name: { contains: 'influye', mode: 'insensitive' } },
  });
  console.log('Influye provider:', JSON.stringify(influye, null, 2));

  // Also check all providers
  const all = await p.menuProvider.findMany({ select: { id: true, name: true, domainPatterns: true, status: true } });
  console.log('\nAll providers:');
  for (const pr of all) {
    console.log(`  ${pr.name} | ${pr.status} | ${pr.domainPatterns.join(', ')}`);
  }

  await p.$disconnect();
}
main();
