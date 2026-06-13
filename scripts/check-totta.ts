import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();

  // Search broadly
  const leads = await p.lead.findMany({
    where: { localName: { contains: "tot", mode: "insensitive" } },
    select: {
      id: true,
      localName: true,
      cartaStatus: true,
      cartaUrl: true,
      cartaFileUrl: true,
      cartaType: true,
      errorLog: true,
      detectedProviderId: true,
      createdAt: true,
      email: true,
      events: true,
      generatedSlug: true,
      preview: true,
    },
  });

  console.log(`Found ${leads.length} leads matching 'tot':`);
  for (const l of leads) {
    console.log("\n---");
    console.log("ID:", l.id);
    console.log("Name:", l.localName);
    console.log("Status:", l.cartaStatus);
    console.log("Type:", l.cartaType);
    console.log("URL:", l.cartaUrl || l.cartaFileUrl || "NONE");
    console.log("Provider:", l.detectedProviderId || "NONE");
    console.log("Error:", l.errorLog || "NONE");
    console.log("Slug:", l.generatedSlug || "NONE");
    console.log("Created:", l.createdAt);
    console.log("Events:", JSON.stringify(l.events, null, 2));
  }

  await p.$disconnect();
}
main();
