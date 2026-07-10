import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const provider = await p.menuProvider.findFirst({ where: { name: "QRco" } });
  if (provider) {
    await p.menuProvider.update({
      where: { id: provider.id },
      data: {
        status: "IN_RESEARCH",
        notes: "QR code landing pages (qrco.de). Content is AngularJS-rendered with PDF loaded dynamically — NOT scrapeable. Extraction always fails. When a lead uses this provider and fails, the pipeline should send a WhatsApp asking them to upload their carta as photo/PDF directly via quierocomer.com/subircarta.",
        extractionConfig: {
          useJina: true,
          notScrapeable: true,
          failMessage: "No pudimos extraer tu carta desde el link que nos compartiste. ¿Podrías subir una foto de tu carta o el PDF directamente? Puedes hacerlo aquí: quierocomer.com/subircarta 😊",
        },
      },
    });
    console.log("Updated QRco provider with failMessage");
  }
  await p.$disconnect();
}
main();
