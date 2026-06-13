import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  // Search by owner name or restaurant name
  const msg = await p.whatsAppMessage.findMany({
    where: { OR: [
      { profileName: { contains: "aquiles", mode: "insensitive" } },
      { profileName: { contains: "baeza", mode: "insensitive" } },
    ]},
    select: { phone: true },
    distinct: ["phone"],
  });
  if (msg.length === 0) {
    // Try by lead/owner
    const lead = await p.lead.findFirst({ where: { ownerName: { contains: "aquiles", mode: "insensitive" } }, select: { whatsapp: true } });
    const owner = await p.restaurantOwner.findFirst({ where: { name: { contains: "aquiles", mode: "insensitive" } }, select: { whatsapp: true } });
    const phone = lead?.whatsapp || owner?.whatsapp;
    if (phone) msg.push({ phone });
  }
  if (msg.length === 0) { console.log("Not found"); await p.$disconnect(); return; }

  const phone = msg[0].phone;
  const msgs = await p.whatsAppMessage.findMany({
    where: { phone },
    select: { direction: true, body: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`=== Aquiles Baeza (${phone}, ${msgs.length} msgs) ===\n`);
  for (const m of msgs) {
    const dir = m.direction === "INBOUND" ? "CLIENTE" : "CAMILA";
    console.log(`[${dir}] ${m.createdAt.toISOString().slice(0,16)}`);
    console.log(m.body);
    console.log();
  }
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
