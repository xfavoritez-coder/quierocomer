import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const leads = await prisma.lead.findMany({
    where: { OR: [
      { email: "elparron2019@gmail.com" },
      { generatedSlug: "el-parron-de-pomaire" },
      { localName: { contains: "pomaire", mode: "insensitive" } },
      { localName: { contains: "parron", mode: "insensitive" } },
      { whatsapp: { contains: "952433979" } },
    ] },
    select: { id: true, localName: true, ownerName: true, email: true, whatsapp: true, generatedSlug: true, cartaStatus: true, cartaUrl: true, step2At: true, completedAt: true, activatedAt: true, createdAt: true },
  });
  console.log("Leads found:", leads.length);
  for (const l of leads) console.log(JSON.stringify(l, null, 2));

  // All leads created June 2
  const june2 = await prisma.lead.findMany({
    where: { createdAt: { gte: new Date("2026-06-02T00:00:00Z"), lte: new Date("2026-06-03T00:00:00Z") } },
    select: { id: true, localName: true, email: true, generatedSlug: true, cartaStatus: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  console.log("\nAll leads June 2:", june2.length);
  for (const l of june2) {
    console.log(`  ${l.createdAt.toISOString().slice(11,19)} ${l.localName || "-"} <${l.email || "-"}> slug=${l.generatedSlug || "-"} ${l.cartaStatus}`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
