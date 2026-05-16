import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  const r = await p.restaurant.findUnique({
    where: { slug: "nascosto-pizzeria" },
    select: { enabledLangs: true, defaultView: true, id: true }
  });
  console.log("Config:", JSON.stringify(r));

  const veganDishes = await p.dish.count({
    where: { restaurantId: r!.id, dietType: { in: ["VEGAN", "VEGETARIAN"] } }
  });
  console.log("Vegan/Veg dishes:", veganDishes);

  const totalDishes = await p.dish.count({
    where: { restaurantId: r!.id }
  });
  console.log("Total dishes:", totalDishes);
}
main().finally(() => p.$disconnect());
