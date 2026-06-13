import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  // Paso 6: Poner el trial a 1 día de expirar para disparar el reminder
  const tomorrow = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);
  await db.restaurant.update({
    where: { slug: "fogon-del-puerto" },
    data: { trialEndsAt: tomorrow, trialReminderSentAt: null },
  });
  console.log("✓ Trial ajustado a expirar mañana:", tomorrow.toISOString());
  console.log("Ahora ejecuta el cron diario para disparar el email de reminder");
}

main().catch(console.error).finally(() => db.$disconnect());
