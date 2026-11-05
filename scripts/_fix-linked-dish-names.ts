/** Quita el emoji 🔥 del nombre de los linkedDishes de Kojo */
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
    // Quitar cualquier emoji al principio del nombre
    const cleanName = dish.name.replace(/^[\p{Emoji}\s]+/u, "").trim();
    if (cleanName !== dish.name) {
      await db.dish.update({ where: { id: dish.id }, data: { name: cleanName } });
      console.log(`✓ "${dish.name}" → "${cleanName}"`);
    } else {
      console.log(`  "${dish.name}" ya está limpio`);
    }
  }
  console.log("\n✅ Listo");
}

main().catch(console.error).finally(() => db.$disconnect());
