import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  const leads = await p.lead.findMany({
    where: { whatsapp: { not: null } },
    select: { id: true, localName: true, whatsapp: true, events: true, generatedSlug: true },
  });

  const actionBodies: Record<string, (name: string, rest: string) => string> = {
    nurturing_no_revisada: (n, r) => `Hola ${n}, tu carta de ${r} esta lista. ¿Quieres verla? — Camila de QuieroComer`,
    nurturing_vio_no_activo: (n, r) => `Hola ${n}, vi que revisaste la carta de ${r}. ¿Necesitas ayuda? — Camila de QuieroComer`,
    nurturing_no_volvio: (n, r) => `Hola ${n}, activaste ${r} pero no has vuelto. ¿Todo bien? — Camila de QuieroComer`,
  };

  let created = 0;
  for (const l of leads) {
    const evts = Array.isArray(l.events) ? l.events as any[] : [];
    const nurts = evts.filter((e: any) => String(e.action).startsWith("nurturing_") && e.sid);
    for (const n of nurts) {
      // Check if already exists
      const exists = await p.whatsAppMessage.findFirst({ where: { twilioSid: n.sid }, select: { id: true } });
      if (exists) continue;

      const rest = l.generatedSlug ? await p.restaurant.findFirst({ where: { slug: l.generatedSlug }, select: { id: true, name: true } }) : null;
      const ownerName = (l.localName || "Hola").split(" ")[0];
      const restName = rest?.name || l.localName || "tu restaurante";
      const bodyFn = actionBodies[n.action];
      const body = bodyFn ? bodyFn(ownerName, restName) : `Camila: ${n.action}`;

      await p.whatsAppMessage.create({
        data: {
          phone: l.whatsapp!.startsWith("+") ? l.whatsapp! : `+${l.whatsapp}`,
          direction: "OUTBOUND",
          body,
          twilioSid: n.sid,
          status: "sent",
          restaurantId: rest?.id || null,
          leadId: l.id,
          createdAt: new Date(n.ts),
        },
      });
      created++;
      console.log(`Created: ${l.whatsapp} | ${n.action} | ${restName}`);
    }
  }

  // Also check if the 12 sent via one-time endpoint have any trace
  // They were sent but events were cleaned. We need to find them another way.
  // Check Twilio SIDs in the response - we don't have them stored anymore.

  console.log(`\nCreated ${created} WA messages from remaining lead events`);

  // The 12 sent via one-time endpoint don't have records anywhere now.
  // Let's create approximate records based on what we know they sent.
  const sentPhones = [
    { wa: "+56981514053", name: "Katherine", rest: "3sazon", action: "nurturing_no_revisada" },
    { wa: "+56985246289", name: "José", rest: "Youseppe", action: "nurturing_no_revisada" },
    { wa: "+56959410461", name: "González", rest: "Carlos", action: "nurturing_vio_no_activo" },
    { wa: "+56981291089", name: "María", rest: "Amaderos", action: "nurturing_vio_no_activo" },
    { wa: "+56956322365", name: "Juan", rest: "Pepito", action: "nurturing_vio_no_activo" },
    { wa: "+56940259158", name: "Elisa", rest: "Lodi Burger", action: "nurturing_vio_no_activo" },
    { wa: "+56998957147", name: "David", rest: "La Vaquita Echá", action: "nurturing_vio_no_activo" },
    { wa: "+56986296864", name: "Miguel", rest: "Éxtasis culinario", action: "nurturing_no_volvio" },
    { wa: "+56933710034", name: "Mauricio", rest: "Koibito atacama", action: "nurturing_no_volvio" },
    { wa: "+56982670252", name: "Dennicer", rest: "Viafara Solis", action: "nurturing_no_volvio" },
    { wa: "+56957800372", name: "Andrea", rest: "Café de la Esquina", action: "nurturing_no_volvio" },
    { wa: "+56957557101", name: "Jesud", rest: "Alejandra@CaracasBurguer", action: "nurturing_no_volvio" },
  ];

  let created2 = 0;
  for (const s of sentPhones) {
    const exists = await p.whatsAppMessage.findFirst({
      where: { phone: s.wa, direction: "OUTBOUND", body: { contains: "Camila" } },
      select: { id: true },
    });
    if (exists) continue;

    const rest = await p.restaurant.findFirst({
      where: { OR: [{ name: { contains: s.rest, mode: "insensitive" } }] },
      select: { id: true },
    }).catch(() => null);

    const lead = await p.lead.findFirst({
      where: { whatsapp: { contains: s.wa.replace("+", "") } },
      select: { id: true },
    }).catch(() => null);

    const bodyFn = actionBodies[s.action];
    const body = bodyFn ? bodyFn(s.name, s.rest) : `Camila: ${s.action}`;

    await p.whatsAppMessage.create({
      data: {
        phone: s.wa,
        direction: "OUTBOUND",
        body,
        status: "sent",
        restaurantId: rest?.id || null,
        leadId: lead?.id || null,
        createdAt: new Date("2026-06-03T03:00:00.000Z"), // approximate time
      },
    });
    created2++;
    console.log(`Created (batch): ${s.wa} | ${s.action} | ${s.rest}`);
  }

  console.log(`\nCreated ${created2} WA messages for batch-sent nurturing`);
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
