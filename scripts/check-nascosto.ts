import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const r = await prisma.restaurant.findFirst({
    where: { OR: [{ slug: { contains: "nascosto" } }, { name: { contains: "Nascosto", mode: "insensitive" } }] },
    select: { id: true, name: true, slug: true, plan: true, subscriptionStatus: true, billingExempt: true, ownerId: true },
  });
  console.log(JSON.stringify(r, null, 2));
}
main().finally(() => prisma.$disconnect());
