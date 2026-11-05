/** Restaura el emoji 🔥 en los linkedDishes de Kojo */
import { config } from "dotenv";
config({ path: ".env.prod" });
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  const KOJO_IDS = ["cmubc0yoq0001jv041si8zicn", "cmvcjbx090001jn074i0eg9zu"];

  const promos = await db.promotion.findMany({
    where: { restaurantId: { in: KOJO_IDS }, linkedDishId: { not: null }, status: { not: "DELETED" } },
    select: { id: true, name: true, linkedDishId: true },
  });

  for (const p of promos) {
    if (!p.linkedDishId) continue;
    const dish = await db.dish.findUnique({ where: { id: p.linkedDishId }, select: { id: true, name: true } });
    if (!dish) continue;
    if (!dish.name.startsWith("🔥")) {
      await db.dish.update({ where: { id: dish.id }, data: { name: `🔥 ${dish.name}` } });
      console.log(`✓ "${dish.name}" → "🔥 ${dish.name}"`);
    } else {
      console.log(`  "${dish.name}" ya tiene emoji`);
    }
  }
  console.log("\n✅ Listo");
}

main().catch(console.error).finally(() => db.$disconnect());
