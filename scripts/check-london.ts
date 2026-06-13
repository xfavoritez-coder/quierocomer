import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const rest = await p.restaurant.findFirst({
    where: { name: { contains: "london", mode: "insensitive" } },
    select: { id: true, name: true, slug: true, owner: { select: { whatsapp: true } } },
  });
  if (!rest?.owner?.whatsapp) { console.log("Not found"); await p.$disconnect(); return; }
  const phone = rest.owner.whatsapp;
  const msgs = await p.whatsAppMessage.findMany({
    where: { phone },
    select: { direction: true, body: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`=== ${rest.name} (${msgs.length} msgs) ===\n`);
  for (const m of msgs) {
    const dir = m.direction === "INBOUND" ? "CLIENTE" : "CAMILA";
    console.log(`[${dir}] ${m.createdAt.toISOString().slice(0,16)}`);
    console.log(m.body);
    console.log();
  }
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
