import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  const phone = "+56934343410";
  const sid = "MM1269f89d363bc9101dd065c31689f6ba";
  const ownerName = "Vaithiare";
  const restaurantName = "Aloha";

  const rest = await p.restaurant.findFirst({ where: { slug: "aloha" }, select: { id: true } });
  const lead = await p.lead.findFirst({ where: { generatedSlug: "aloha" }, select: { id: true } });

  await p.whatsAppMessage.create({
    data: {
      phone,
      direction: "OUTBOUND",
      body: `Hola ${ownerName}, vi que revisaste la carta de ${restaurantName}. ¿Todo bien? Estoy para ayudarte — Camila de QuieroComer`,
      twilioSid: sid,
      status: "sent",
      restaurantId: rest?.id || null,
      leadId: lead?.id || null,
    },
  });
  console.log("WhatsAppMessage creado");

  if (rest) {
    await p.panelActivity.create({
      data: {
        restaurantId: rest.id,
        action: "nurturing_vio_no_activo",
        details: { sid, whatsapp: phone, ownerName, restaurantName },
      },
    });
    console.log("PanelActivity creado");
  }

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
