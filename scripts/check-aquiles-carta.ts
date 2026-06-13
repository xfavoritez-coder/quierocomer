import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const lead = await p.lead.findFirst({
    where: { ownerName: { contains: "aquiles", mode: "insensitive" } },
    select: { id: true, localName: true, ownerName: true, cartaUrl: true, cartaFileUrl: true, cartaType: true, cartaStatus: true, generatedSlug: true, errorLog: true, email: true, whatsapp: true },
  });
  console.log("Lead:", JSON.stringify(lead, null, 2));

  if (lead?.generatedSlug) {
    const rest = await p.restaurant.findFirst({
      where: { slug: lead.generatedSlug },
      select: { id: true, name: true, slug: true, isDemo: true, _count: { select: { dishes: true, categories: true } } },
    });
    console.log("Restaurant:", JSON.stringify(rest, null, 2));
  }
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
