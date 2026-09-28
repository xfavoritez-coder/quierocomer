import { config } from "dotenv";
config({ path: ".env.prod" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const r = await prisma.restaurant.findFirst({
    where: { name: { contains: "oveja", mode: "insensitive" } },
    select: { id: true, name: true, flowPlanId: true },
  });
  if (!r) { console.log("No encontrado"); return; }
  await prisma.restaurant.update({
    where: { id: r.id },
    data: { flowPlanId: "qc_monthly" },
  });
  console.log(`✅ ${r.name}: flowPlanId actualizado qc_premium_monthly → qc_monthly`);
  await prisma.$disconnect();
}
main();
