import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const lead = await p.lead.findFirst({
    where: { localName: { contains: "alto gourmet", mode: "insensitive" } },
    select: { id: true, localName: true, ownerName: true, cartaUrl: true, cartaFileUrl: true, cartaType: true, cartaStatus: true, generatedSlug: true, errorLog: true },
  });
  console.log("Lead:", JSON.stringify(lead, null, 2));

  if (lead?.generatedSlug) {
    const rest = await p.restaurant.findFirst({
      where: { slug: lead.generatedSlug },
      select: { id: true, name: true, slug: true, _count: { select: { dishes: true, categories: true } } },
    });
    console.log("Restaurant:", JSON.stringify(rest, null, 2));

    if (rest) {
      const dishes = await p.dish.findMany({
        where: { restaurantId: rest.id },
        select: { name: true, price: true, photos: true, category: { select: { name: true } } },
        take: 10,
      });
      console.log("Sample dishes:", JSON.stringify(dishes, null, 2));
    }
  }
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
