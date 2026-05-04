/**
 * Marca como exempt a TODOS los locales actuales (son legacy pre-Flow),
 * cancela la suscripcion de prueba de Horus y limpia sus campos de billing.
 *
 * Uso: npx tsx scripts/setup-legacy-exempt.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { PrismaClient } from "@prisma/client";
import { flowPost } from "../src/lib/billing/flow";

const prisma = new PrismaClient();

async function main() {
  // Cancelar Horus en Flow si tiene suscripcion
  const horus = await prisma.restaurant.findFirst({ where: { slug: "horusvegan" } });
  if (horus?.flowSubscriptionId) {
    console.log(`Cancelando suscripcion de Horus en Flow (${horus.flowSubscriptionId})...`);
    try {
      await flowPost("/subscription/cancel", {
        subscriptionId: horus.flowSubscriptionId,
        at_period_end: 0, // cancelar inmediato, sin esperar fin de periodo
      });
      console.log("OK cancelado en Flow");
    } catch (e: any) {
      console.log("Aviso al cancelar:", e.message);
    }
    await prisma.restaurant.update({
      where: { id: horus.id },
      data: {
        flowSubscriptionId: null,
        flowPlanId: null,
        pendingFlowPlanId: null,
        flowRegisterToken: null,
        subscriptionStatus: "NONE",
        trialEndsAt: null,
        currentPeriodEnd: null,
      },
    });
    console.log("Campos de billing de Horus limpiados");
  }

  // Marcar todos los locales actuales como exempt
  const result = await prisma.restaurant.updateMany({
    data: { billingExempt: true },
  });
  console.log(`\n${result.count} locales marcados como exempt`);

  await prisma.$disconnect();
  console.log("Listo.");
}

main().catch(async (e) => {
  console.error("Error:", e);
  await prisma.$disconnect();
  process.exit(1);
});
