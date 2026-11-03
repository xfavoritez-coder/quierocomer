import { config } from "dotenv";
config({ path: ".env.prod" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.restaurant.findMany({
    where: { name: { contains: "kojo", mode: "insensitive" } },
    select: { id: true, slug: true, name: true, ecommerceStoreConfig: true },
  });
  rows.forEach((r) => {
    const cfg = r.ecommerceStoreConfig as any;
    console.log(`${r.name} (${r.slug}) => brandSlug: ${cfg?.brandSlug ?? "(null)"}, pickup: ${cfg?.pickupEnabled}, delivery: ${cfg?.deliveryEnabled}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
