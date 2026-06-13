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
        notes: "Canva design links. Strategy: 1) Jina extracts text with X-No-Cache header. 2) If text has 3+ prices, use text extraction with Claude (PREFERRED — most reliable). 3) If no prices in text, try downloading page images from media.canva.com (upgrade height:99 thumbnails to height:1600), resize to 1200px JPEG via sharp, send max 4 to Claude Vision. 4) Last fallback: screenshot. TEXT FIRST approach fixed repeated Claude Vision 400 errors caused by large Canva PNG images.",
        extractionConfig: {
          preferText: true,
          preferVision: false,
          maxImages: 4,
          imageHeight: 1600,
          imageWidth: 1200,
          resizeForClaude: true,
          jinaNoCache: true,
        },
      },
    });
    console.log("Updated Canva provider — text-first strategy");
  }
  await p.$disconnect();
}
main();
