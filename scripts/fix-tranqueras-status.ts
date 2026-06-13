import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const lead = await p.lead.findFirst({
    where: { localName: { contains: "tranquera", mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
  });
  if (!lead) { console.log("Not found"); await p.$disconnect(); return; }

  // Check if restaurant exists
  const rest = await p.restaurant.findFirst({ where: { slug: "las-tranqueras" } });
  console.log("Restaurant exists:", !!rest);

  await p.lead.update({
    where: { id: lead.id },
    data: {
      cartaStatus: "DELIVERED",
      generatedSlug: rest ? "las-tranqueras" : lead.generatedSlug,
    },
  });
  console.log("Restored to DELIVERED");
  await p.$disconnect();
}
main();
