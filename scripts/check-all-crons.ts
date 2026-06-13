import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Check if OTHER crons ran today — to determine if it's a Vercel-wide issue or just weekly-email
  const today = new Date("2026-06-01T00:00:00Z");

  const todayLogs = await prisma.cronLog.findMany({
    where: { createdAt: { gte: today } },
    orderBy: { createdAt: "desc" },
  });

  console.log(`=== Crons ejecutados hoy 1 junio (${todayLogs.length} total) ===\n`);
  const byJob: Record<string, number> = {};
  for (const log of todayLogs) {
    byJob[log.jobName] = (byJob[log.jobName] || 0) + 1;
  }
  for (const [job, count] of Object.entries(byJob).sort()) {
    const last = todayLogs.find(l => l.jobName === job);
    console.log(`  ${job}: ${count} ejecuciones — último: ${last?.createdAt.toISOString()} (${last?.status})`);
  }

  if (!byJob["weekly-email"]) {
    console.log("\n  ❌ weekly-email NO corrió hoy");
  }

  // Check last deployment timestamp via any recent cron
  const lastAnyCron = await prisma.cronLog.findFirst({
    orderBy: { createdAt: "desc" },
  });
  console.log(`\n  Último cron de cualquier tipo: ${lastAnyCron?.jobName} @ ${lastAnyCron?.createdAt.toISOString()}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
