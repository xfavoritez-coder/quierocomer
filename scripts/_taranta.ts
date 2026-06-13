import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const r = await prisma.restaurant.findFirst({
    where: { slug: "taranta-chicureo" },
    select: { id: true, name: true, slug: true },
  });
  if (!r) { console.log("No encontrado"); return; }

  const cats = await prisma.category.findMany({
    where: { restaurantId: r.id },
    orderBy: { position: "asc" },
    select: { id: true, name: true, position: true, isActive: true },
  });
  console.log("=== CATEGORÍAS ===");
  for (const c of cats) console.log(`  [${c.position}] ${c.name} (active: ${c.isActive})`);

  const dishes = await prisma.dish.findMany({
    where: { restaurantId: r.id },
    orderBy: [{ categoryId: "asc" }, { position: "asc" }],
    select: { id: true, name: true, price: true, description: true, photos: true, categoryId: true, position: true },
  });
  console.log(`\n=== PLATOS (${dishes.length} total) ===`);
  const withPhoto = dishes.filter(d => d.photos && (d.photos as any[]).length > 0);
  console.log(`Con foto: ${withPhoto.length} | Sin foto: ${dishes.length - withPhoto.length}`);
  for (const c of cats) {
    const catDishes = dishes.filter(d => d.categoryId === c.id);
    console.log(`\n  --- ${c.name} (${catDishes.length} platos) ---`);
    for (const d of catDishes) {
      const photos = d.photos as any[];
      const photo = photos?.length ? `📷x${photos.length}` : "  ";
      console.log(`  ${photo} ${d.name} | $${d.price} | ${d.description?.substring(0, 60) || "-"}`);
    }
  }

  const lead = await prisma.lead.findFirst({
    where: { generatedSlug: "taranta-chicureo" },
    select: { id: true, cartaStatus: true, sourceType: true, sourceUrl: true },
  });
  console.log("\n=== LEAD ===");
  console.log("Status:", lead?.cartaStatus);
  console.log("Source type:", lead?.sourceType);
  console.log("Source URL:", lead?.sourceUrl);

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
