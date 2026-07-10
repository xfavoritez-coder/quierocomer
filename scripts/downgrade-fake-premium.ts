/**
 * downgrade-fake-premium.ts
 *
 * Baja a FREE todos los restaurantes con plan GOLD/PREMIUM que:
 *  - NO tienen suscripción Flow activa (flowSubscriptionId IS NULL)
 *  - NO tienen suscripción MercadoPago (mpSubscriptionId IS NULL)
 *  - NO están marcados como billingExempt (bonificados)
 *  - NO tienen subscriptionStatus = ACTIVE (pago confirmado)
 *  - NO tienen currentPeriodEnd en el futuro (periodo pagado vigente)
 *
 * Corre primero en DRY_RUN=true para revisar. Luego DRY_RUN=false para aplicar.
 *
 * Uso:
 *   npx tsx scripts/downgrade-fake-premium.ts
 *   DRY_RUN=false npx tsx scripts/downgrade-fake-premium.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN !== "false";

async function main() {
  console.log(`\n🔍 Modo: ${DRY_RUN ? "DRY RUN (solo lectura)" : "⚠️  APLICANDO CAMBIOS"}\n`);

  const now = new Date();

  // Restaurantes que SÍ tienen protección — no tocar
  const protected_ = await prisma.restaurant.findMany({
    where: {
      plan: { in: ["GOLD", "PREMIUM"] },
      OR: [
        { billingExempt: true },
        { flowSubscriptionId: { not: null } },
        { mpSubscriptionId: { not: null } },
        { subscriptionStatus: "ACTIVE" },
        { currentPeriodEnd: { gt: now } },
      ],
    },
    select: { id: true, name: true, slug: true, plan: true, subscriptionStatus: true, billingExempt: true, flowSubscriptionId: true, mpSubscriptionId: true, currentPeriodEnd: true },
    orderBy: { name: "asc" },
  });

  console.log(`✅ PROTEGIDOS (no se tocan) — ${protected_.length} restaurantes:`);
  for (const r of protected_) {
    const reasons = [];
    if (r.billingExempt) reasons.push("billingExempt");
    if (r.flowSubscriptionId) reasons.push(`Flow: ${r.flowSubscriptionId}`);
    if (r.mpSubscriptionId) reasons.push(`MP: ${r.mpSubscriptionId}`);
    if (r.subscriptionStatus === "ACTIVE") reasons.push("status=ACTIVE");
    if (r.currentPeriodEnd && r.currentPeriodEnd > now) reasons.push(`periodo hasta ${r.currentPeriodEnd.toLocaleDateString("es-CL")}`);
    console.log(`  - ${r.name} (${r.slug}) [${r.plan}] → ${reasons.join(", ")}`);
  }

  // Restaurantes que serán bajados a FREE
  const toDowngrade = await prisma.restaurant.findMany({
    where: {
      plan: { in: ["GOLD", "PREMIUM"] },
      billingExempt: false,
      flowSubscriptionId: null,
      mpSubscriptionId: null,
      subscriptionStatus: { not: "ACTIVE" },
      OR: [
        { currentPeriodEnd: null },
        { currentPeriodEnd: { lte: now } },
      ],
    },
    select: { id: true, name: true, slug: true, plan: true, subscriptionStatus: true, trialEndsAt: true, isDemo: true },
    orderBy: { name: "asc" },
  });

  console.log(`\n⬇️  A BAJAR A FREE — ${toDowngrade.length} restaurantes:`);
  for (const r of toDowngrade) {
    console.log(`  - ${r.name} (${r.slug}) [${r.plan} / ${r.subscriptionStatus}]${r.isDemo ? " [demo]" : ""}${r.trialEndsAt ? ` trial venció: ${r.trialEndsAt.toLocaleDateString("es-CL")}` : " sin trial"}`);
  }

  if (toDowngrade.length === 0) {
    console.log("\n  Nada que hacer.");
    return;
  }

  if (DRY_RUN) {
    console.log(`\n⚡ Para aplicar corre: DRY_RUN=false npx tsx scripts/downgrade-fake-premium.ts\n`);
    return;
  }

  // Aplicar
  const ids = toDowngrade.map(r => r.id);
  const result = await prisma.restaurant.updateMany({
    where: { id: { in: ids } },
    data: {
      plan: "FREE",
      subscriptionStatus: "NONE",
      trialEndsAt: null,
    },
  });

  console.log(`\n✅ ${result.count} restaurantes bajados a FREE.\n`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
