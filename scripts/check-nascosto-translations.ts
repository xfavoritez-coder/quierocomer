import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const count = await p.dishTranslation.count({ where: { dish: { restaurantId: "cmolxj7gd0000ie04m2sd0e6k" } } });
  console.log("Total translations:", count);
  const en = await p.dishTranslation.count({ where: { dish: { restaurantId: "cmolxj7gd0000ie04m2sd0e6k" }, lang: "en" } });
  console.log("English translations:", en);
  const sample = await p.dishTranslation.findFirst({ where: { dish: { restaurantId: "cmolxj7gd0000ie04m2sd0e6k" }, lang: "en" }, include: { dish: { select: { name: true } } } });
  console.log("Sample:", JSON.stringify(sample, null, 2));
}
main().finally(() => p.$disconnect());
