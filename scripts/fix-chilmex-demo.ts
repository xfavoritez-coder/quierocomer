import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  const r = await db.restaurant.findUnique({
    where: { id: "cmpwtmx1o0000js043fylj5zc" },
    select: { name: true, slug: true, isDemo: true, plan: true, subscriptionStatus: true, trialEndsAt: true },
  });
  console.log("Estado actual Chilmex:", JSON.stringify(r, null, 2));
  
  // Si está en demo, activarlo
  if (r?.isDemo) {
    await db.restaurant.update({
      where: { id: "cmpwtmx1o0000js043fylj5zc" },
      data: {
        isDemo: false,
        subscriptionStatus: "TRIALING",
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
    console.log("✓ Chilmex activado (trial 14 días)");
  }
}

main().catch(console.error).finally(() => db.$disconnect());
