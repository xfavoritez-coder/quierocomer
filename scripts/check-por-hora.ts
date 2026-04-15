import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const cats = await p.menuItem.groupBy({ by: ["categoria"], where: { isAvailable: true }, _count: true, orderBy: { _count: { id: "desc" } } });
  console.log("Platos por categoría:");
  cats.forEach(c => console.log(`  ${c.categoria}: ${c._count}`));

  const hour = new Date().getHours();
  console.log(`\nHora actual: ${hour}h`);
  const timeCats = hour >= 6 && hour < 12 ? ["BREAKFAST", "BRUNCH"]
    : hour >= 12 && hour < 16 ? ["MAIN_COURSE", "PASTA", "PIZZA", "SUSHI", "BURGER", "SANDWICH"]
    : hour >= 16 && hour < 19 ? ["SANDWICH", "SALAD", "SNACK"]
    : hour >= 19 && hour < 23 ? ["MAIN_COURSE", "SUSHI", "SEAFOOD"]
    : [];
  console.log("Categorías con bonus:", timeCats.join(", ") || "ninguna");

  for (const cat of timeCats) {
    const count = await p.menuItem.count({ where: { isAvailable: true, categoria: cat } });
    console.log(`  ${cat}: ${count} platos`);
  }
}
main().finally(() => p.$disconnect());
