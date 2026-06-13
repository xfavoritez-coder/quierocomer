import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const owner = await p.restaurantOwner.findFirst({ where: { restaurants: { some: { name: { contains: "acampados", mode: "insensitive" } } } }, select: { whatsapp: true } });
  const lead = await p.lead.findFirst({ where: { localName: { contains: "acampados", mode: "insensitive" } }, select: { whatsapp: true } });
  const phone = owner?.whatsapp || lead?.whatsapp;
  if (!phone) { console.log("Not found"); await p.$disconnect(); return; }
  const msgs = await p.whatsAppMessage.findMany({
    where: { phone: { contains: phone.replace("+", "") } },
    select: { direction: true, body: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`=== Acampados (${phone}, ${msgs.length} msgs) ===\n`);
  for (const m of msgs) {
    const dir = m.direction === "INBOUND" ? "CLIENTE" : "CAMILA";
    console.log(`[${dir}] ${m.createdAt.toISOString().slice(0,16)}`);
    console.log(m.body);
    console.log();
  }
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
