import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  await db.dish.update({
    where: { id: "cmps4lsez0006l104w6qpx7n7" },
    data: { isActive: true },
  });
  console.log("✓ Estofado de pollo con arroz activado");
}
main().catch(console.error).finally(() => db.$disconnect());
