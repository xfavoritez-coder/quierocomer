import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const r = await prisma.restaurant.update({
    where: { slug: "nascosto-pizzeria" },
    data: { billingExempt: false },
    select: { name: true, plan: true, subscriptionStatus: true, billingExempt: true },
  });
  console.log("✓ Nascosto:", r);
}
main().finally(() => prisma.$disconnect());
