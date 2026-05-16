import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const r = await prisma.restaurant.update({
    where: { slug: "nascosto-pizzeria" },
    data: { isDemo: true },
    select: { id: true, name: true, slug: true, isDemo: true, plan: true },
  });
  console.log("Updated:", JSON.stringify(r, null, 2));
}
main().finally(() => prisma.$disconnect());
