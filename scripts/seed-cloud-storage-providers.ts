/**
 * Seed cloud storage menu providers: Google Drive, Dropbox, OneDrive.
 * Run with:
 *   npx tsx scripts/seed-cloud-storage-providers.ts
 *
 * Safe to run multiple times — uses upsert by name.
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PROVIDERS = [
  {
    name: "GoogleDrive",
    domainPatterns: ["drive.google.com"],
    htmlSignatures: [],
    status: "SUPPORTED" as const,
    notes: "Google Drive PDF share links. Converts /file/d/{id}/view to direct download URL. Uses pdf-parse + Claude PDF Vision fallback for scanned PDFs.",
    extractionConfig: {
      visionFallbackThreshold: 200,
      maxTextChars: 30000,
    },
  },
  {
    name: "Dropbox",
    domainPatterns: ["dropbox.com", "www.dropbox.com"],
    htmlSignatures: ["dropbox-web", "dbx-header"],
    status: "SUPPORTED" as const,
    notes: "Dropbox shared links. Add ?dl=1 to get direct download. Currently uses generic scraper — consider a dedicated extractor if needed.",
    extractionConfig: {},
  },
  {
    name: "OneDrive",
    domainPatterns: ["onedrive.live.com", "1drv.ms", "sharepoint.com"],
    htmlSignatures: ["onedrive", "SkyDrive"],
    status: "IN_RESEARCH" as const,
    notes: "Microsoft OneDrive / SharePoint shared links. Currently uses generic scraper. Direct download requires resolving the share token.",
    extractionConfig: {},
  },
];

async function main() {
  console.log("Seeding cloud storage menu providers...\n");

  for (const provider of PROVIDERS) {
    // Check if already exists by name
    const existing = await prisma.menuProvider.findFirst({
      where: { name: provider.name },
    });

    if (existing) {
      await prisma.menuProvider.update({
        where: { id: existing.id },
        data: {
          domainPatterns: provider.domainPatterns,
          htmlSignatures: provider.htmlSignatures,
          status: provider.status,
          notes: provider.notes,
          extractionConfig: provider.extractionConfig,
        },
      });
      console.log(`Updated: ${provider.name} (${existing.id})`);
    } else {
      const created = await prisma.menuProvider.create({
        data: {
          name: provider.name,
          domainPatterns: provider.domainPatterns,
          htmlSignatures: provider.htmlSignatures,
          status: provider.status,
          notes: provider.notes,
          extractionConfig: provider.extractionConfig,
        },
      });
      console.log(`Created: ${provider.name} (${created.id})`);
    }
  }

  console.log("\nDone.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
