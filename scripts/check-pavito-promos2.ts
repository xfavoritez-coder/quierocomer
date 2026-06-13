import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const promos = await db.promotionMarketing.findMany({
    where: { restaurant: { slug: "la-picada-del-pa-vito" }, status: "ACTIVE" },
    select: { id: true, name: true, promoType: true, promoPrice: true, dishIds: true, imageUrl: true, description: true },
  });
  for (const p of promos) {
    console.log(`"${p.name}" — type: ${p.promoType}, price: ${p.promoPrice}, dishIds: [${p.dishIds.join(",")}], image: ${p.imageUrl ? "sí" : "no"}`);
  }
}
main().catch(console.error).finally(() => db.$disconnect());
