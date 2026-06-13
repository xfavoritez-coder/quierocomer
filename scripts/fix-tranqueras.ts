import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
async function main() {
  const p = new PrismaClient();
  const lead = await p.lead.findFirst({ where: { localName: { contains: "tranquera", mode: "insensitive" } }, orderBy: { createdAt: "desc" } });
  if (!lead) { console.log("Not found"); await p.$disconnect(); return; }

  // Check if restaurant still exists
  const rest = await p.restaurant.findFirst({ where: { slug: "las-tranqueras" } });
  console.log("Restaurant exists:", !!rest, rest?.id || "DELETED");

  if (!rest) {
    // Restaurant was deleted by our script, need to reprocess to recreate it
    // Just restore status to PENDING so Reprocess button works, and clear WA
    await p.lead.update({
      where: { id: lead.id },
      data: {
        cartaStatus: "PENDING",
        whatsappSentAt: null,
        whatsappClickedAt: null,
      },
    });
    console.log("Restaurant deleted — lead stays PENDING for reprocessing. Cleared fake WA timestamps.");
  } else {
    // Restaurant exists, restore to DELIVERED
    await p.lead.update({
      where: { id: lead.id },
      data: {
        cartaStatus: "DELIVERED",
        generatedSlug: "las-tranqueras",
        whatsappSentAt: null,
        whatsappClickedAt: null,
      },
    });
    console.log("Restored to DELIVERED with slug, cleared fake WA timestamps.");
  }
  await p.$disconnect();
}
main();
