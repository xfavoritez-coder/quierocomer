import { config } from "dotenv";
config({ path: ".env.prod" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const r = await prisma.restaurant.findUnique({
    where: { slug: "test-autocobro" },
    select: { id: true, name: true },
  });
  if (!r) { console.log("No encontrado"); return; }

  // Simular suscripción Flow activa con período que vence mañana
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.restaurant.update({
    where: { id: r.id },
    data: {
      plan: "PREMIUM",
      subscriptionStatus: "ACTIVE",
      isActive: true,
      flowSubscriptionId: "sus_TEST_AUTOCOBRO",
      flowPlanId: "qc_monthly",
      currentPeriodEnd: tomorrow,
      lastPaymentAt: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000), // "pagó" hace 29 días
    },
  });

  console.log(`✅ ${r.name} configurado:`);
  console.log(`   plan: PREMIUM`);
  console.log(`   flowSubscriptionId: sus_TEST_AUTOCOBRO`);
  console.log(`   currentPeriodEnd: ${tomorrow.toLocaleString("es-CL")}`);
  console.log(`\n👉 Mañana el cron billing-recovery lo detectará y lo extenderá`);
  console.log(`   (si Flow confirma suscripción activa — en este caso fallará por ser fake)`);
  console.log(`\n   Para probar el webhook: llamar manualmente POST /api/billing/webhook`);

  await prisma.$disconnect();
}
main();
