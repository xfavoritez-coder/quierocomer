import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  const [conOwner, sinOwner, total] = await Promise.all([
    p.restaurant.count({ where: { ownerId: { not: null } } }),
    p.restaurant.count({ where: { ownerId: null } }),
    p.restaurant.count(),
  ]);
  console.log(`Total: ${total} | Con owner: ${conOwner} | Sin owner (Google/importados): ${sinOwner}`);

  const sample = await p.restaurant.findMany({
    where: { ownerId: null },
    select: { name: true, slug: true },
    take: 8,
  });
  console.log("\nMuestra sin owner:");
  sample.forEach(r => console.log(" -", r.name, "|", r.slug));
}

main().catch(console.error).finally(() => p.$disconnect());
