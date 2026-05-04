/**
 * Recupera inscripciones en curso que perdieron el callback de return.
 *
 * Busca Restaurants con flowRegisterToken seteado pero sin flowSubscriptionId,
 * verifica el estado del registro en Flow, y si la tarjeta quedo inscrita
 * crea la suscripcion con trial de 14 dias.
 *
 * Usage: npx tsx scripts/recover-pending-subscription.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { PrismaClient } from "@prisma/client";
import { flowPost } from "../src/lib/billing/flow";
import { planFromFlowId, TRIAL_DAYS } from "../src/lib/billing/plans-config";

const prisma = new PrismaClient();

async function main() {
  const stuck = await prisma.restaurant.findMany({
    where: {
      flowRegisterToken: { not: null },
      flowSubscriptionId: null,
    },
    select: {
      id: true, name: true, flowRegisterToken: true,
      flowCustomerId: true, pendingFlowPlanId: true, plan: true,
    },
  });

  console.log(`Encontrados ${stuck.length} restaurants con inscripcion en curso\n`);

  for (const r of stuck) {
    console.log(`-> ${r.name} (${r.id})`);
    if (!r.flowCustomerId || !r.pendingFlowPlanId || !r.flowRegisterToken) {
      console.log("   skip: faltan datos\n");
      continue;
    }

    // Asumimos que la tarjeta quedo inscrita (el comerciante completo Webpay)
    // y vamos directo a crear la suscripcion. Si Flow dice que no hay tarjeta,
    // /subscription/create tirara error y avisara.
    const subscription = await flowPost<{ subscriptionId: string; periodEnd?: string }>(
      "/subscription/create",
      {
        planId: r.pendingFlowPlanId,
        customerId: r.flowCustomerId,
        trial_period_days: TRIAL_DAYS,
      }
    );

    const appPlan = planFromFlowId(r.pendingFlowPlanId) || r.plan;
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    await prisma.restaurant.update({
      where: { id: r.id },
      data: {
        flowSubscriptionId: subscription.subscriptionId,
        flowPlanId: r.pendingFlowPlanId,
        plan: appPlan,
        subscriptionStatus: "TRIALING",
        trialEndsAt,
        currentPeriodEnd: subscription.periodEnd ? new Date(subscription.periodEnd) : trialEndsAt,
        flowRegisterToken: null,
        pendingFlowPlanId: null,
      },
    });

    console.log(`   suscripcion creada: ${subscription.subscriptionId}`);
    console.log(`   plan: ${appPlan}, trial hasta ${trialEndsAt.toISOString().slice(0, 10)}\n`);
  }

  await prisma.$disconnect();
  console.log("Listo.");
}

main().catch(async (e) => {
  console.error("\nError:", e.message);
  await prisma.$disconnect();
  process.exit(1);
});
