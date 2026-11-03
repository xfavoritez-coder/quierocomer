import { config } from "dotenv";
config({ path: ".env.prod" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// These are the confirmed duplicates:
// - "Martes de suprema" (no photos, no emoji) is the duplicate of "🔥 Martes de suprema" (1 photo, with emoji)
// Only delete the ones WITHOUT photos.
const TO_DELETE = [
  { id: "cmw0uh5xi0003encwa49xg9xt", name: "Martes de suprema", restaurant: "kojo-sushi-la-florida" },
  { id: "cmw0uhfmj000dencwamro24jc", name: "Martes de suprema", restaurant: "kojo-sushi-recoleta" },
];

async function main() {
  console.log("Verifying dishes before deletion:");
  for (const d of TO_DELETE) {
    const dish = await prisma.dish.findUnique({
      where: { id: d.id },
      select: { id: true, name: true, photos: true, isActive: true, deletedAt: true },
    });
    if (!dish) {
      console.log(`  ⚠ NOT FOUND: ${d.id}`);
      continue;
    }
    if (dish.photos.length > 0) {
      console.log(`  ⚠ SKIP (has photos!): ${d.id} "${dish.name}" photos=${dish.photos.length}`);
      continue;
    }
    console.log(`  ✓ Will delete: ${d.id} "${dish.name}" [${d.restaurant}] photos=${dish.photos.length}`);
  }

  const safeToDelete = [];
  for (const d of TO_DELETE) {
    const dish = await prisma.dish.findUnique({
      where: { id: d.id },
      select: { photos: true },
    });
    if (dish && dish.photos.length === 0) {
      safeToDelete.push(d.id);
    }
  }

  if (safeToDelete.length === 0) {
    console.log("\nNothing to delete.");
    return;
  }

  const result = await prisma.dish.deleteMany({
    where: { id: { in: safeToDelete } },
  });
  console.log(`\n✅ Deleted ${result.count} duplicate dish(es) without photos: ${safeToDelete.join(", ")}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
