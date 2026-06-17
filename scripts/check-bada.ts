import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
async function main() {
  const p = new PrismaClient();
  const r = await p.restaurant.findFirst({
    where: { OR: [{ slug: "bada" }, { name: { contains: "bada", mode: "insensitive" } }] },
    select: { id: true, slug: true, name: true, isActive: true, _count: { select: { dishes: true } } },
  });
  console.log(JSON.stringify(r, null, 2));
  if (r) {
    const dishes = await p.dish.findMany({
      where: { restaurantId: r.id },
      select: { name: true, photos: true },
      take: 8,
    });
    for (const d of dishes) {
      const photo = (d.photos as string[])?.[0] ?? "no photo";
      console.log(d.name, "|", photo.slice(0, 100));
    }
  }
  await p.$disconnect();
}
main().catch(console.error);
