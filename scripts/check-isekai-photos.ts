import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const r = await prisma.restaurant.findUnique({ where: { slug: "isekai-ramen" } });
  if (!r) throw new Error("not found");

  const dishes = await prisma.dish.findMany({
    where: { restaurantId: r.id, isActive: true, deletedAt: null },
    select: { name: true, photos: true },
    take: 5,
  });

  for (const d of dishes) {
    console.log(`${d.name}: ${d.photos[0] || "(sin foto)"}`);
    if (d.photos[0]) {
      try {
        const res = await fetch(d.photos[0], { method: "HEAD", signal: AbortSignal.timeout(5000) });
        console.log(`  → ${res.status} ${res.statusText} · type: ${res.headers.get("content-type")}`);
      } catch (e: any) {
        console.log(`  → ERROR: ${e.message}`);
      }
    }
  }
}

main().finally(() => prisma.$disconnect());
