import { prisma } from "@/lib/prisma";
async function main() {
  const r = await prisma.restaurant.findMany({
    where: { name: { contains: "kojo", mode: "insensitive" } },
    select: { id: true, slug: true, name: true, ecommerceDeliveryConfig: true }
  });
  console.log(JSON.stringify(r, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
