import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const existing = await p.menuProvider.findFirst({ where: { name: "Queresto" } });
  if (existing) {
    await p.menuProvider.update({
      where: { id: existing.id },
      data: {
        notes: "Queresto/Bistrify digital menu. JSON-LD parsing for dishes, HTML regex for images. Images from cdn.bistrify.app use w/h params — extractor upgrades from 128px thumbnails to 800px HD automatically.",
        extractionConfig: {
          imageWidth: 800,
          imageHeight: 800,
        },
      },
    });
    console.log(`Updated: Queresto (${existing.id})`);
  } else {
    console.log("Queresto provider not found");
  }
  await p.$disconnect();
}
main();
