/**
 * migrate-loyalty-to-pro.mjs
 *
 * Activa loyalty (loyaltyStatus = "ACTIVE") en todos los restaurantes
 * que tienen plan PREMIUM con suscripción activa y aún no tienen loyalty activo.
 *
 * Ejecutar con: node scripts/migrate-loyalty-to-pro.mjs
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// NONE = nunca se suscribió (pero puede estar en trial de carta), TRIALING = trial, ACTIVE = pagando, PAST_DUE = tarde pero aún activo
const ACTIVE_STATUSES = ["ACTIVE", "TRIALING", "PAST_DUE", "NONE"];

async function main() {
  // Encontrar restaurantes Pro activos sin loyalty activo
  const targets = await prisma.restaurant.findMany({
    where: {
      plan: "PREMIUM",
      subscriptionStatus: { in: ACTIVE_STATUSES },
      loyaltyStatus: { notIn: ["ACTIVE", "TRIALING"] },
    },
    select: { id: true, name: true, plan: true, subscriptionStatus: true, loyaltyStatus: true },
  });

  console.log(`\nRestaurantes a actualizar: ${targets.length}`);
  if (targets.length === 0) {
    console.log("Nada que migrar.\n");
    return;
  }

  for (const r of targets) {
    console.log(`  [${r.id}] ${r.name} — plan:${r.plan} sub:${r.subscriptionStatus} loyalty:${r.loyaltyStatus}`);
  }

  const { count } = await prisma.restaurant.updateMany({
    where: {
      plan: "PREMIUM",
      subscriptionStatus: { in: ACTIVE_STATUSES },
      loyaltyStatus: { notIn: ["ACTIVE", "TRIALING"] },
    },
    data: { loyaltyStatus: "ACTIVE" },
  });

  console.log(`\nMigración completada: ${count} restaurantes actualizados con loyaltyStatus = "ACTIVE"\n`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
