import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const r = await db.restaurant.findFirst({
    where: { slug: { contains: "pavito" } },
    select: { id: true, name: true, slug: true, logoUrl: true },
  });
  console.log(JSON.stringify(r, null, 2));
}
main().catch(console.error).finally(() => db.$disconnect());
