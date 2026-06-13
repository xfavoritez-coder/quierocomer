import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const r = await db.restaurant.findFirst({
    where: { name: { contains: "pavito", mode: "insensitive" } },
    select: { id: true, name: true, slug: true, logoUrl: true },
  });
  if (!r) {
    const all = await db.restaurant.findMany({
      where: { name: { contains: "picada", mode: "insensitive" } },
      select: { name: true, slug: true, logoUrl: true },
    });
    console.log("Picadas:", JSON.stringify(all, null, 2));
  } else {
    console.log(JSON.stringify(r, null, 2));
  }
}
main().catch(console.error).finally(() => db.$disconnect());
