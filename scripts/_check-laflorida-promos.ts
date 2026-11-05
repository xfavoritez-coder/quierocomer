import { config } from "dotenv";
config({ path: ".env.prod" });
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const LA_FLORIDA = "cmubc0yoq0001jv041si8zicn";

async function main() {
const promos = await db.promotion.findMany({
  where: { restaurantId: LA_FLORIDA },
  select: { id: true, name: true, status: true, linkedDishId: true, dishIds: true, daysOfWeek: true, hideOriginalWhenActive: true },
  orderBy: { createdAt: "asc" },
});
console.log("=== PROMOS La Florida ===");
for (const p of promos) {
  console.log(`[${p.id}] "${p.name}" status=${p.status} days=[${p.daysOfWeek}] linkedDish=${p.linkedDishId ?? "null"} dishIds=${p.dishIds.length}`);
}

const cat = await db.category.findFirst({
  where: { restaurantId: LA_FLORIDA, name: { equals: "Promociones", mode: "insensitive" } },
  select: { id: true, name: true },
});
console.log(`\n=== Categoría Promociones: ${cat?.id ?? "NO EXISTE"} ===`);
if (cat) {
  const dishes = await db.dish.findMany({
    where: { categoryId: cat.id, deletedAt: null },
    select: { id: true, name: true, isActive: true, price: true, discountPrice: true, position: true },
    orderBy: { position: "asc" },
  });
  for (const d of dishes) {
    console.log(`  pos=${d.position} "${d.name}" active=${d.isActive} price=${d.price} discount=${d.discountPrice ?? "-"} [${d.id}]`);
  }

  // Ver también cuáles linkedDishIds apuntan a estos platos
  const dishIds = dishes.map((d) => d.id);
  const linked = await db.promotion.findMany({
    where: { restaurantId: LA_FLORIDA, linkedDishId: { in: dishIds } },
    select: { id: true, name: true, linkedDishId: true },
  });
  console.log("\n  Promos que apuntan a estos dishes:");
  for (const p of linked) {
    console.log(`    promo "${p.name}" [${p.id}] → linkedDish ${p.linkedDishId}`);
  }
}

await db.$disconnect();
}
main().catch(console.error);
