import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const ACTION_BODIES: Record<string, (name: string, restaurant: string) => string> = {
  nurturing_carta_no_revisada: (name, rest) => `Hola ${name}, tu carta de ${rest} esta lista y esperandote. ¿Quieres verla? — Camila de QuieroComer`,
  nurturing_vio_no_activo: (name, rest) => `Hola ${name}, vi que revisaste la carta de ${rest}. ¿Necesitas ayuda para activar tu local? — Camila de QuieroComer`,
  nurturing_no_volvio: (name, rest) => `Hola ${name}, hace unos dias activaste ${rest} pero no has vuelto. ¿Todo bien? Estoy para ayudarte — Camila de QuieroComer`,
};

async function main() {
  const activities = await p.panelActivity.findMany({
    where: { action: { startsWith: "nurturing_" } },
    select: { id: true, action: true, details: true, restaurantId: true, createdAt: true },
  });

  console.log(`Found ${activities.length} nurturing activities`);
  let created = 0;

  for (const a of activities) {
    const d = a.details as any;
    if (!d?.whatsapp || !d?.sid) continue;

    // Check if WhatsAppMessage already exists for this SID
    const existing = await p.whatsAppMessage.findFirst({
      where: { twilioSid: d.sid },
      select: { id: true },
    });
    if (existing) continue;

    // Find lead by phone
    const lead = await p.lead.findFirst({
      where: { whatsapp: { contains: d.whatsapp.replace("+", "") } },
      select: { id: true },
    }).catch(() => null);

    const bodyFn = ACTION_BODIES[a.action];
    const body = bodyFn ? bodyFn(d.ownerName || "Hola", d.restaurantName || "tu restaurante") : `Nurturing: ${a.action}`;

    await p.whatsAppMessage.create({
      data: {
        phone: d.whatsapp,
        direction: "OUTBOUND",
        body,
        twilioSid: d.sid,
        status: "sent",
        restaurantId: a.restaurantId,
        leadId: lead?.id || null,
        createdAt: a.createdAt,
      },
    });
    created++;
    console.log(`  Created: ${d.whatsapp} | ${a.action} | ${d.restaurantName}`);
  }

  console.log(`\nDone: created ${created} WhatsAppMessage records`);
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
