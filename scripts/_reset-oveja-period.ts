import { config } from "dotenv";
config({ path: ".env.prod" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const r = await prisma.restaurant.findFirst({
    where: { name: { contains: "oveja", mode: "insensitive" } },
    select: { id: true, name: true, currentPeriodEnd: true },
  });
  if (!r) { console.log("No encontrado"); return; }
  // Resetear al ciclo real: 27 de septiembre
  const cycleDate = new Date("2026-09-27T16:48:39.725Z");
  await prisma.restaurant.update({
    where: { id: r.id },
    data: { currentPeriodEnd: cycleDate },
  });
  console.log(`✅ ${r.name}: currentPeriodEnd → ${cycleDate.toLocaleDateString("es-CL")}`);
  console.log(`   Cuando llegue el pago, el webhook calculará: ~27 oct`);
  await prisma.$disconnect();
}
main();
