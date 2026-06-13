import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Check last cron executions for weekly-email
  const logs = await prisma.cronLog.findMany({
    where: { jobName: "weekly-email" },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  console.log("=== Últimas ejecuciones del cron weekly-email ===\n");
  if (logs.length === 0) {
    console.log("❌ No hay registros de ejecución del cron weekly-email");
  } else {
    for (const log of logs) {
      console.log(`${log.createdAt.toISOString()} | ${log.status} | ${log.durationMs}ms`);
      console.log(`  Details: ${JSON.stringify(log.details)}`);
      if (log.error) console.log(`  Error: ${log.error}`);
      console.log();
    }
  }

  // Check restaurants that should receive weekly email
  const targets = await prisma.restaurant.findMany({
    where: { isActive: true, weeklyEmailEnabled: true },
    select: { slug: true, name: true, isDemo: true, owner: { select: { email: true } } },
  });

  console.log(`\n=== Restaurantes con weeklyEmailEnabled = true (${targets.length}) ===\n`);
  for (const r of targets) {
    console.log(`  ${r.isDemo ? "🟡 DEMO" : "🟢 REAL"} ${r.slug} — ${r.name} — ${r.owner?.email || "SIN EMAIL"}`);
  }

  // Check recent email logs for weekly_summary
  const recentEmails = await prisma.emailLog.findMany({
    where: { purpose: "weekly_summary", createdAt: { gte: new Date("2026-05-25") } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  console.log(`\n=== Emails weekly_summary desde 25 mayo (${recentEmails.length}) ===\n`);
  for (const e of recentEmails) {
    console.log(`  ${e.createdAt.toISOString()} | ${e.status} | ${e.to} | ${e.subject}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
