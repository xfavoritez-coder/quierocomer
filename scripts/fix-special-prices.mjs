import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Alleria Delivery: bonificado (sin cobro carta QR), pero loyalty NO bonificado
const r = await prisma.restaurant.findFirst({
  where: { name: { contains: "Alleria Delivery", mode: "insensitive" }, isDemo: false },
  select: { id: true, name: true, loyaltyStatus: true, loyaltyPeriodEnd: true },
});

if (!r) {
  console.log("⚠️  No encontrado: Alleria Delivery");
} else {
  await prisma.restaurant.update({
    where: { id: r.id },
    data: {
      billingExempt: true,
      plan: "GOLD",
      subscriptionStatus: "ACTIVE",
      currentPeriodEnd: new Date("2099-12-31"),
      customPlanPriceNet: null, // bonificado, no tiene precio especial
      // loyalty se deja como está (no se toca)
    },
  });
  console.log("✅", r.name, "→ bonificado (carta QR). Loyalty intacto:", r.loyaltyStatus);
}

await prisma.$disconnect();
