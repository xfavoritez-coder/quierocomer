import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const provider = await p.menuProvider.findFirst({ where: { name: "Canva" } });
  if (provider) {
    await p.menuProvider.update({
      where: { id: provider.id },
      data: {
        notes: "Canva design links. Menu is a graphic design, not structured data. Strategy: Jina extracts page image URLs (media.canva.com), upgrade from thumbnail (99px) to full-res (1600px), download immediately (URLs expire in minutes), resize to 1200px JPEG, send max 5 images to Claude Vision. Sharp resize required to avoid Claude 400 payload errors.",
        extractionConfig: {
          preferVision: true,
          maxImages: 5,
          imageHeight: 1600,
          imageWidth: 1200,
          resizeForClaude: true,
        },
      },
    });
    console.log("Updated Canva provider");
  }
  await p.$disconnect();
}
main();
