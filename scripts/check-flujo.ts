import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  try {
    const r = await p.$queryRaw`SELECT COUNT(*) FROM "GastoFlujo"`;
    console.log('GastoFlujo OK:', JSON.stringify(r));
  } catch(e: any) {
    console.error('GastoFlujo ERROR:', e.message);
  }
  try {
    const r2 = await p.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE '%lujo%' OR table_name LIKE '%gasto%'`;
    console.log('Similar tables:', JSON.stringify(r2));
  } catch(e: any) {
    console.error('Query error:', e.message);
  }
  await p.$disconnect();
}
main();
