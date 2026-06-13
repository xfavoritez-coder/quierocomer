import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Find the orphan lead from June 2 ~13:16 Chile (17:16 UTC)
  const lead = await prisma.lead.findFirst({
    where: {
      createdAt: { gte: new Date("2026-06-02T17:15:00Z"), lte: new Date("2026-06-02T17:18:00Z") },
      localName: "",
    },
  });
  if (!lead) { console.log("Lead not found"); return; }
  console.log("Found lead:", lead.id, lead.cartaUrl, lead.cartaStatus);

  // Update with Pomaire data
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      localName: "El Parron De Pomaire",
      ownerName: "Karen Chávez",
      email: "elparron2019@gmail.com",
      whatsapp: "+56952433979",
      generatedSlug: "el-parron-de-pomaire",
      cartaStatus: "DELIVERED",
      readyAt: new Date("2026-06-02T17:11:27Z"),
      deliveredAt: new Date("2026-06-02T17:11:27Z"),
      activatedAt: new Date("2026-06-02T17:29:40Z"),
    },
  });
  console.log("Updated lead with Pomaire data");
}
main().catch(console.error).finally(() => prisma.$disconnect());
