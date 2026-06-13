import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();

  // Update provider to use Jina + higher content limit
  const provider = await p.menuProvider.findFirst({ where: { domainPatterns: { has: "qrco.de" } } });
  if (provider) {
    await p.menuProvider.update({
      where: { id: provider.id },
      data: {
        name: "QRco",
        status: "SUPPORTED",
        notes: "QR code landing pages (qrco.de). Content is AngularJS-rendered, often links to PDF. Use Jina for scraping.",
        extractionConfig: { useJina: true, maxContentChars: 60000 },
      },
    });
    console.log("Updated QRco provider");
  }

  // Reset lead
  await p.lead.updateMany({
    where: { localName: { contains: "viceverza", mode: "insensitive" }, cartaStatus: "FAILED" },
    data: { cartaStatus: "PENDING", errorLog: null },
  });
  console.log("Reset Viceverza to PENDING");

  await p.$disconnect();
}
main();
