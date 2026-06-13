import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function showChat(nameFilter: string) {
  // Find by lead name first
  const lead = await p.lead.findFirst({
    where: { OR: [
      { ownerName: { contains: nameFilter, mode: "insensitive" } },
      { localName: { contains: nameFilter, mode: "insensitive" } },
    ]},
    select: { id: true, ownerName: true, localName: true, whatsapp: true, cartaStatus: true },
  });

  const rest = await p.restaurant.findFirst({
    where: { name: { contains: nameFilter, mode: "insensitive" } },
    select: { id: true, name: true, slug: true, plan: true, isActive: true },
  });

  console.log(`\n${"=".repeat(60)}`);
  if (rest) {
    console.log(`🍽️  ${rest.name} (${rest.slug}) | plan: ${rest.plan} | active: ${rest.isActive}`);
  }

  const owner = rest ? await p.restaurantOwner.findFirst({
    where: { restaurants: { some: { id: rest.id } } },
    select: { whatsapp: true, name: true },
  }) : null;
  if (owner) console.log(`👤 Owner: ${owner.name} | WA: ${owner.whatsapp}`);
  if (lead) console.log(`📋 Lead: ${lead.ownerName} (${lead.localName}) | WA: ${lead.whatsapp} | status: ${lead.cartaStatus}`);

  // Collect all phone numbers to search
  const phones: string[] = [];
  if (owner?.whatsapp) phones.push(owner.whatsapp.replace("+", ""));
  if (lead?.whatsapp) phones.push(lead.whatsapp.replace("+", ""));

  // Search by restaurantId OR by phone
  const conditions: any[] = [];
  if (rest) conditions.push({ restaurantId: rest.id });
  if (lead) conditions.push({ leadId: lead.id });
  for (const ph of phones) conditions.push({ phone: { contains: ph } });

  if (conditions.length === 0) {
    console.log("❌ Sin datos para buscar mensajes");
    return;
  }

  const msgs = await p.whatsAppMessage.findMany({
    where: { OR: conditions },
    select: { direction: true, body: true, createdAt: true, profileName: true, phone: true },
    orderBy: { createdAt: "asc" },
  });

  if (msgs.length === 0) {
    console.log("📭 No hay mensajes WhatsApp registrados");
    return;
  }

  console.log(`\n💬 ${msgs.length} mensajes:`);
  console.log("-".repeat(60));
  for (const m of msgs) {
    const dir = m.direction === "INBOUND" ? "👤 CLIENTE" : "🤖 CAMILA";
    const date = m.createdAt.toLocaleString("es-CL", { timeZone: "America/Santiago" });
    console.log(`\n[${dir}] ${date} (${m.phone})`);
    console.log(m.body);
  }
}

async function main() {
  await showChat("viafara");
  await showChat("fogon");
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
