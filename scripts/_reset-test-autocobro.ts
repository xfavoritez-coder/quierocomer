import { config } from "dotenv";
config({ path: ".env.prod" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const in3days = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);
  await prisma.restaurant.update({
    where: { slug: "test-autocobro" },
    data: {
      plan: "PREMIUM",
      subscriptionStatus: "ACTIVE",
      isActive: true,
      flowSubscriptionId: null,
      flowCustomerId: null,
      flowPlanId: null,
      flowRegisterToken: null,
      pendingFlowPlanId: null,
      currentPeriodEnd: in3days,
      lastPaymentAt: new Date(Date.now() - 27 * 24 * 60 * 60 * 1000),
    },
  });
  console.log(`✅ Test Autocobro: vence el ${in3days.toLocaleDateString("es-CL")} (mañana)`);
  console.log(`   Ahora ve al panel → Mi Restaurante → Plan → activar cobro automático`);
  await prisma.$disconnect();
}
main();
