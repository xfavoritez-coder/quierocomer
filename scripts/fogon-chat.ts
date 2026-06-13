import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  const rest = await p.restaurant.findFirst({
    where: { slug: "fogon-del-puerto" },
    select: { id: true, name: true, plan: true, isActive: true },
  });
  console.log("Restaurant:", rest);

  const owner = await p.restaurantOwner.findFirst({
    where: { restaurants: { some: { id: rest!.id } } },
    select: { id: true, name: true, whatsapp: true, email: true },
  });
  console.log("Owner:", owner);

  // Messages by restaurantId
  let msgs = await p.whatsAppMessage.findMany({
    where: { restaurantId: rest!.id },
    select: { direction: true, body: true, createdAt: true, phone: true },
    orderBy: { createdAt: "asc" },
  });
  console.log("Messages by restaurantId:", msgs.length);

  // Messages by phone
  if (msgs.length === 0 && owner?.whatsapp) {
    const ph = owner.whatsapp.replace("+", "");
    msgs = await p.whatsAppMessage.findMany({
      where: { phone: { contains: ph } },
      select: { direction: true, body: true, createdAt: true, phone: true },
      orderBy: { createdAt: "asc" },
    });
    console.log("Messages by phone:", msgs.length);
  }

  // Check lead by owner
  if (owner?.whatsapp) {
    const lead = await p.lead.findFirst({
      where: { whatsapp: owner.whatsapp },
      select: { id: true, localName: true, ownerName: true, whatsapp: true },
    });
    console.log("Lead by phone:", lead);
    if (lead) {
      const lMsgs = await p.whatsAppMessage.findMany({
        where: { leadId: lead.id },
        select: { direction: true, body: true, createdAt: true, phone: true },
        orderBy: { createdAt: "asc" },
      });
      console.log("Messages by leadId:", lMsgs.length);
      msgs = lMsgs.length > msgs.length ? lMsgs : msgs;
    }
  }

  if (msgs.length > 0) {
    console.log("\n=== CONVERSACION ===");
    for (const m of msgs) {
      const dir = m.direction === "INBOUND" ? "CLIENTE" : "CAMILA";
      console.log(`\n[${dir}] ${m.createdAt.toISOString()}`);
      console.log(m.body);
    }
  } else {
    console.log("No hay mensajes");
  }

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
