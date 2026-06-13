import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const MAX_KB = 130;

async function checkRestaurant(slug: string) {
  const r = await p.restaurant.findFirst({ where: { slug }, select: { id: true, name: true } });
  if (!r) return;

  const dishes = await p.dish.findMany({
    where: { restaurantId: r.id, deletedAt: null, isActive: true },
    select: { id: true, name: true, photos: true },
  });

  const withPhotos = dishes.filter(d => d.photos.length > 0);
  let totalKB = 0;
  const heavy: { name: string; sizeKB: number }[] = [];

  for (const d of withPhotos) {
    for (const url of d.photos) {
      try {
        const res = await fetch(url, { method: "HEAD" });
        const size = parseInt(res.headers.get("content-length") || "0");
        const kb = Math.round(size / 1024);
        totalKB += kb;
        if (kb > MAX_KB) heavy.push({ name: d.name, sizeKB: kb });
      } catch {}
    }
  }

  console.log(`\n══════ ${r.name} (${slug}) ══════`);
  console.log(`Platos: ${dishes.length} | Con foto: ${withPhotos.length}`);
  console.log(`Peso total: ${(totalKB / 1024).toFixed(1)} MB`);
  console.log(`Pesadas (>${MAX_KB}KB): ${heavy.length}`);
  if (heavy.length > 0) {
    heavy.sort((a, b) => b.sizeKB - a.sizeKB);
    for (const h of heavy) console.log(`  ⚠ ${h.name}: ${h.sizeKB} KB`);
  }
}

async function main() {
  // Find slugs by name
  const names = ["horus", "hand roll", "esquina"];
  for (const name of names) {
    const results = await p.restaurant.findMany({
      where: { name: { contains: name, mode: "insensitive" } },
      select: { slug: true, name: true },
    });
    for (const r of results) {
      console.log(`Found: ${r.name} → ${r.slug}`);
      await checkRestaurant(r.slug);
    }
  }
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
