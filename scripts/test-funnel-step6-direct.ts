// Ejecutar directamente la lógica del paso 6 usando fetch a la API de Resend
// en vez del wrapper sendAdminEmail
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  // Buscar la key correcta — intentamos con la de Vercel runtime
  // Si no funciona localmente, disparamos contra producción
  
  // Primero verifico el estado
  const r = await db.restaurant.findUnique({
    where: { slug: "fogon-del-puerto" },
    select: { id: true, name: true, trialEndsAt: true, trialReminderSentAt: true, subscriptionStatus: true },
  });
  console.log("Estado:", JSON.stringify(r, null, 2));
  
  if (r?.trialReminderSentAt) {
    console.log("⚠ Reminder ya fue marcado como enviado. Reseteando para probar...");
    await db.restaurant.update({
      where: { slug: "fogon-del-puerto" },
      data: { trialReminderSentAt: null },
    });
  }
  
  console.log("\n→ Para disparar el paso 6 en producción, necesitamos el CRON_SECRET.");
  console.log("→ Alternativa: ir a Vercel Dashboard > Crons y disparar manualmente 'diario'");
  console.log("→ O podemos hacer un deploy temporal con un endpoint de test");
  console.log("\n→ Por ahora adelantemos al paso 7 (expirar el trial) que también envía email+WA");
}

main().catch(console.error).finally(() => db.$disconnect());
