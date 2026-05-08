import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const r = await prisma.restaurant.findUnique({ where: { slug: "isekai-ramen" } });
  if (!r) throw new Error("not found");
  const updated = await prisma.dish.updateMany({
    where: { restaurantId: r.id },
    data: { photos: [] },
  });
  console.log(`Limpiadas ${updated.count} fotos rotas`);
}

main().finally(() => prisma.$disconnect());
