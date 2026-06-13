import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const r = await prisma.restaurant.findUnique({ where: { slug: "el-parron-de-pomaire" }, select: { id: true, website: true } });
  if (!r) { console.log("Not found"); return; }
  const dishes = await prisma.dish.count({ where: { restaurantId: r.id } });
  const cats = await prisma.category.count({ where: { restaurantId: r.id } });
  console.log("Dishes:", dishes, "Categories:", cats, "Website:", r.website);
}
main().catch(console.error).finally(() => prisma.$disconnect());
