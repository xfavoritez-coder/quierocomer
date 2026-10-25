import { config } from "dotenv";
config({ path: ".env.prod" });
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  const r = await p.restaurant.findFirst({
    where: { name: { contains: "guff", mode: "insensitive" } },
    select: {
      id: true, name: true, slug: true, plan: true, isActive: true,
      subscriptionStatus: true, currentPeriodEnd: true, lastPaymentAt: true,
      flowSubscriptionId: true, flowCustomerId: true, pendingFlowPlanId: true,
      flowRegisterToken: true, flowPlanId: true,
    },
  });
  console.log(JSON.stringify(r, null, 2));

  if (!r) { console.log("No encontrado"); return; }

  // Últimas actividades de panel
  const acts = await (p as any).panelActivity.findMany({
    where: { restaurantId: r.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { type: true, description: true, createdAt: true },
  });
  console.log("\nActividades recientes:", JSON.stringify(acts, null, 2));
}
main().finally(() => p.$disconnect());
