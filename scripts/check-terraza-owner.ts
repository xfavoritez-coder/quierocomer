import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const r = await db.restaurant.findFirst({
    where: { slug: { contains: "terraza" } },
    select: { id: true, name: true, slug: true, owner: { select: { name: true, email: true } } },
  });
  console.log(JSON.stringify(r, null, 2));
  const lead = await db.lead.findFirst({
    where: { generatedSlug: r?.slug },
    select: { ownerName: true, email: true },
  });
  console.log("Lead:", JSON.stringify(lead, null, 2));
}
main().catch(console.error).finally(() => db.$disconnect());
