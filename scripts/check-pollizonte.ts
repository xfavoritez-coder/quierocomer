import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const rest = await p.restaurant.findFirst({ where: { name: { contains: "pollizonte", mode: "insensitive" } }, select: { owner: { select: { whatsapp: true } } } });
  const phone = rest?.owner?.whatsapp;
  if (!phone) { console.log("Not found"); await p.$disconnect(); return; }
  const msgs = await p.whatsAppMessage.findMany({ where: { phone }, select: { direction: true, body: true, createdAt: true }, orderBy: { createdAt: "asc" } });
  for (const m of msgs) {
    const dir = m.direction === "INBOUND" ? "CLIENTE" : "CAMILA";
    console.log(`[${dir}] ${m.createdAt.toISOString().slice(0,16)}`);
    console.log(m.body);
    console.log();
  }
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
