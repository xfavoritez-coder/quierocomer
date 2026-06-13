import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const { searchUnsplashPhoto, triggerUnsplashDownload } = await import("../src/lib/unsplash");
  const dish = await prisma.dish.findFirst({ where: { name: "Roll Pap Hilo" }, select: { id: true } });
  if (!dish) { console.log("Not found"); return; }
  const photo = await searchUnsplashPhoto("sushi roll avocado crispy");
  if (photo) {
    await prisma.dish.update({ where: { id: dish.id }, data: { photos: [photo.rawUrl], isPhotoReferential: true, photoCredits: [{ photographer: photo.photographer, profileUrl: photo.profileUrl, unsplashId: photo.unsplashId }] } });
    triggerUnsplashDownload(photo.downloadLocation).catch(() => {});
    console.log("Done:", photo.photographer);
  } else {
    console.log("No photo found");
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
