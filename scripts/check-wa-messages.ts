import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  const total = await p.whatsAppMessage.count();
  const outbound = await p.whatsAppMessage.count({ where: { direction: "OUTBOUND" } });
  const inbound = await p.whatsAppMessage.count({ where: { direction: "INBOUND" } });
  console.log(`Total WA messages: ${total} | Outbound: ${outbound} | Inbound: ${inbound}`);

  // Check Caracas specifically
  const caracas = await p.whatsAppMessage.findMany({
    where: { phone: { contains: "57557101" } },
    select: { direction: true, body: true, createdAt: true, status: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`\nCaracasBurguer messages: ${caracas.length}`);
  for (const m of caracas) {
    console.log(`  [${m.direction}] ${m.createdAt.toISOString()} | ${(m.body || "").substring(0, 80)}`);
  }

  // Check recent outbound (last 48h)
  const recent = await p.whatsAppMessage.findMany({
    where: { direction: "OUTBOUND", createdAt: { gt: new Date(Date.now() - 48 * 60 * 60 * 1000) } },
    select: { phone: true, body: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  console.log(`\nRecent outbound (48h): ${recent.length}`);
  for (const m of recent) {
    console.log(`  ${m.phone} | ${(m.body || "").substring(0, 60)} | ${m.createdAt.toISOString()}`);
  }

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
