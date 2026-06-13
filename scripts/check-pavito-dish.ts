import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const d = await db.dish.findUnique({
    where: { id: "cmps4lsez0006l104w6qpx7n7" },
    select: { id: true, name: true, isActive: true, deletedAt: true, photos: true },
  });
  console.log(JSON.stringify(d, null, 2));
}
main().catch(console.error).finally(() => db.$disconnect());
