import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const veg = await p.dish.count({ where: { restaurantId: "cmolxj7gd0000ie04m2sd0e6k", dishDiet: { in: ["VEGAN", "VEGETARIAN"] } } });
  console.log("Vegan/Veg:", veg);
  const total = await p.dish.count({ where: { restaurantId: "cmolxj7gd0000ie04m2sd0e6k" } });
  console.log("Total:", total);
  // Mark 3 dishes as VEGAN for demo
  if (veg === 0) {
    const dishes = await p.dish.findMany({ where: { restaurantId: "cmolxj7gd0000ie04m2sd0e6k", isActive: true }, take: 3, select: { id: true, name: true } });
    for (const d of dishes) {
      await p.dish.update({ where: { id: d.id }, data: { dishDiet: "VEGAN" } });
      console.log("Marked as VEGAN:", d.name);
    }
  }
}
main().finally(() => p.$disconnect());
