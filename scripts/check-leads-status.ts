import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  const leads = await p.lead.findMany({
    where: { OR: [
      { localName: { contains: "terraza", mode: "insensitive" } },
      { localName: { contains: "pavito", mode: "insensitive" } },
      { localName: { contains: "chancho", mode: "insensitive" } },
      { localName: { contains: "cabeza", mode: "insensitive" } },
      { localName: { contains: "picada", mode: "insensitive" } },
    ]},
    select: { localName: true, ownerName: true, whatsapp: true, cartaStatus: true, deliveredAt: true, activatedAt: true, panelVisitedAt: true, emailClickedAt: true, whatsappClickedAt: true, events: true, generatedSlug: true },
  });

  if (leads.length === 0) {
    console.log("No se encontraron leads con esos nombres");
    // Try restaurant names
    const rests = await p.restaurant.findMany({
      where: { OR: [
        { name: { contains: "terraza", mode: "insensitive" } },
        { name: { contains: "pavito", mode: "insensitive" } },
        { name: { contains: "chancho", mode: "insensitive" } },
        { name: { contains: "cabeza", mode: "insensitive" } },
        { name: { contains: "picada", mode: "insensitive" } },
      ]},
      select: { name: true, slug: true, plan: true, subscriptionStatus: true, createdAt: true },
    });
    console.log("\nRestaurantes encontrados:");
    for (const r of rests) {
      console.log(`  ${r.name} | slug=${r.slug} | plan=${r.plan} | status=${r.subscriptionStatus} | created=${r.createdAt.toISOString()}`);
      const lead = await p.lead.findFirst({ where: { generatedSlug: r.slug }, select: { localName: true, ownerName: true, whatsapp: true, cartaStatus: true, deliveredAt: true, activatedAt: true, panelVisitedAt: true, emailClickedAt: true, whatsappClickedAt: true, events: true } });
      if (lead) {
        const evts = Array.isArray(lead.events) ? lead.events as any[] : [];
        const nurt = evts.filter((e: any) => String(e.action).startsWith("nurturing"));
        console.log(`    lead: ${lead.localName} | ${lead.ownerName} | ${lead.whatsapp}`);
        console.log(`    status=${lead.cartaStatus} delivered=${lead.deliveredAt?.toISOString()||"null"} activated=${lead.activatedAt?.toISOString()||"null"}`);
        console.log(`    panel=${lead.panelVisitedAt?.toISOString()||"null"} emailClick=${lead.emailClickedAt?.toISOString()||"null"} waClick=${lead.whatsappClickedAt?.toISOString()||"null"}`);
        console.log(`    nurturing: ${nurt.length ? nurt.map((e:any) => e.action).join(", ") : "NINGUNO"}`);
      } else {
        console.log("    (sin lead asociado)");
      }
    }
  } else {
    for (const l of leads) {
      const evts = Array.isArray(l.events) ? l.events as any[] : [];
      const nurt = evts.filter((e: any) => String(e.action).startsWith("nurturing"));
      console.log("---");
      console.log(`${l.localName} | ${l.ownerName} | ${l.whatsapp}`);
      console.log(`  status=${l.cartaStatus} delivered=${l.deliveredAt?.toISOString()||"null"}`);
      console.log(`  activated=${l.activatedAt?.toISOString()||"null"} panel=${l.panelVisitedAt?.toISOString()||"null"}`);
      console.log(`  emailClick=${l.emailClickedAt?.toISOString()||"null"} waClick=${l.whatsappClickedAt?.toISOString()||"null"}`);
      console.log(`  slug=${l.generatedSlug}`);
      console.log(`  nurturing: ${nurt.length ? nurt.map((e:any) => e.action).join(", ") : "NINGUNO"}`);
    }
  }

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
