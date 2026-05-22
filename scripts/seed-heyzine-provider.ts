/**
 * Seed Heyzine flip-book menu provider.
 * Run with:
 *   npx tsx scripts/seed-heyzine-provider.ts
 *
 * Safe to run multiple times — uses upsert by name.
 * Also reassigns any existing leads with heyzine.com URLs to this provider.
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Heyzine menu provider...\n");

  const existing = await prisma.menuProvider.findFirst({
    where: { name: "Heyzine" },
  });

  let providerId: string;

  if (existing) {
    await prisma.menuProvider.update({
      where: { id: existing.id },
      data: {
        domainPatterns: ["heyzine.com"],
        htmlSignatures: ["flipbookcfg", "heyzine.load"],
        status: "SUPPORTED",
        notes: "Heyzine PDF flip-book viewer. Renders PDFs as JS-based flip-books — scrapers can't read content. Strategy: parse flipbookcfg from page HTML to get PDF filename, download from CDN (cdnc.heyzine.com/files/uploaded/), delegate to document extractor with Claude PDF Vision.",
        extractionConfig: {
          preferVision: true,
          cdnBase: "https://cdnc.heyzine.com/files/uploaded/",
        },
      },
    });
    providerId = existing.id;
    console.log(`Updated: Heyzine (${existing.id})`);
  } else {
    const created = await prisma.menuProvider.create({
      data: {
        name: "Heyzine",
        domainPatterns: ["heyzine.com"],
        htmlSignatures: ["flipbookcfg", "heyzine.load"],
        status: "SUPPORTED",
        notes: "Heyzine PDF flip-book viewer. Renders PDFs as JS-based flip-books — scrapers can't read content. Strategy: parse flipbookcfg from page HTML to get PDF filename, download from CDN (cdnc.heyzine.com/files/uploaded/), delegate to document extractor with Claude PDF Vision.",
        extractionConfig: {
          preferVision: true,
          cdnBase: "https://cdnc.heyzine.com/files/uploaded/",
        },
      },
    });
    providerId = created.id;
    console.log(`Created: Heyzine (${created.id})`);
  }

  // Also clean up: if Lead Doctor auto-created an UNKNOWN provider for heyzine.com, reassign those leads
  const unknownHeyzine = await prisma.menuProvider.findMany({
    where: {
      domainPatterns: { has: "heyzine.com" },
      id: { not: providerId },
    },
  });

  for (const unk of unknownHeyzine) {
    const reassigned = await prisma.lead.updateMany({
      where: { detectedProviderId: unk.id },
      data: { detectedProviderId: providerId },
    });
    console.log(`Reassigned ${reassigned.count} leads from unknown provider ${unk.id} → Heyzine (${providerId})`);
    await prisma.menuProvider.delete({ where: { id: unk.id } });
    console.log(`Deleted old unknown provider: ${unk.id}`);
  }

  // Reset any FAILED leads with heyzine.com URLs so they can be reprocessed
  const failedLeads = await prisma.lead.updateMany({
    where: {
      cartaUrl: { contains: "heyzine.com" },
      cartaStatus: "FAILED",
      detectedProviderId: providerId,
    },
    data: {
      cartaStatus: "PENDING",
      errorLog: null,
    },
  });
  if (failedLeads.count > 0) {
    console.log(`Reset ${failedLeads.count} FAILED heyzine leads to PENDING for reprocessing`);
  }

  console.log("\nDone.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
