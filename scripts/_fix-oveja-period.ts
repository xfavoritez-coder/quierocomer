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

  // Extender 30 días desde hoy
  const newEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await prisma.restaurant.update({
    where: { id: r.id },
    data: { currentPeriodEnd: newEnd, subscriptionStatus: "ACTIVE", isActive: true },
  });
  console.log(`✅ ${r.name} extendido hasta ${newEnd.toLocaleDateString("es-CL")}`);
  await prisma.$disconnect();
}
main();
