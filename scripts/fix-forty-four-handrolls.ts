import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();

  const rest = await p.restaurant.findFirst({
    where: { slug: "forty-four" },
    select: { id: true, name: true },
  });
  if (!rest) { console.log("Restaurant not found"); await p.$disconnect(); return; }

  const photoUrl = "https://awbeyxfqtrdfhengabmw.supabase.co/storage/v1/object/public/fotos/dishes/cmpqagug100dbla048rlc8r9l-1780023338144-handrolls-champinon.webp";

  // Find all handroll dishes
  const handrolls = await p.dish.findMany({
    where: {
      restaurantId: rest.id,
      category: { name: { contains: "hand", mode: "insensitive" } },
    },
    select: { id: true, name: true },
  });

  console.log(`Found ${handrolls.length} handroll dishes:`);
  for (const h of handrolls) console.log(`  - ${h.name}`);

  const result = await p.dish.updateMany({
    where: { id: { in: handrolls.map(h => h.id) } },
    data: { photos: [photoUrl], isPhotoReferential: true },
  });

  console.log(`Updated ${result.count} handrolls with photo`);
  await p.$disconnect();
}

main().catch(console.error);
