import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const restaurant = await prisma.restaurant.findFirst({
    where: { OR: [{ slug: "terraza-alameda" }, { name: { contains: "Terraza", mode: "insensitive" } }] },
    select: { id: true, name: true, slug: true, plan: true, defaultView: true },
  });
  if (!restaurant) { console.log("Not found!"); return; }
  console.log("Restaurant:", JSON.stringify(restaurant, null, 2));

  const dishes = await prisma.dish.findMany({
    where: { restaurantId: restaurant.id },
    select: { id: true, name: true, photos: true, photoCredits: true, isPhotoReferential: true, category: { select: { name: true } } },
  });
  console.log(`\nTotal dishes: ${dishes.length}`);
  const unsplash = dishes.filter(d => d.photos.some((p: string) => p.includes("unsplash.com")));
  const real = dishes.filter(d => d.photos.length > 0 && !d.photos.some((p: string) => p.includes("unsplash.com")));
  const noPhoto = dishes.filter(d => d.photos.length === 0);
  console.log(`Unsplash photos: ${unsplash.length}`);
  console.log(`Real photos: ${real.length}`);
  console.log(`No photos: ${noPhoto.length}`);
  
  console.log("\nAll dishes:");
  for (const d of dishes) {
    const photo = d.photos.length > 0 ? d.photos[0].substring(0, 100) : 'NO PHOTO';
    console.log(`  [${d.category?.name}] ${d.name}: ${photo}`);
  }

  // Check leads
  const lead = await (prisma as any).lead.findFirst({
    where: { restaurant: { slug: "terraza-alameda" } },
    select: { id: true, source: true, menuUrl: true, status: true, provider: true },
  }).catch(() => null);
  console.log("\nLead:", JSON.stringify(lead, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
