import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Get yesterday and today dates
  const today = new Date("2026-04-25");
  const yesterday = new Date("2026-04-24");

  // Set to start of day
  yesterday.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  console.log(
    `\n📊 Horus Vegan Stats - From ${yesterday.toDateString()} to ${today.toDateString()}\n`
  );

  // Get the restaurant
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: "horusvegan" },
  });

  if (!restaurant) {
    console.error("❌ Restaurant 'horusvegan' not found");
    await prisma.$disconnect();
    return;
  }

  console.log(`✓ Found restaurant: ${restaurant.name} (${restaurant.id})\n`);

  // Helper function to analyze data for a date range
  async function analyzeSessionsForDateRange(
    startDate: Date,
    endDate: Date,
    label: string
  ) {
    const sessions = await prisma.session.findMany({
      where: {
        restaurantId: restaurant.id,
        startedAt: {
          gte: startDate,
          lt: endDate,
        },
      },
      include: {
        qrUser: {
          select: {
            id: true,
            birthDate: true,
          },
        },
      },
    });

    // Filter sessions with real activity (exclude bots and sessions with zero activity)
    const activeSessions = sessions.filter(
      (s) =>
        !s.isBot &&
        (s.durationMs === null || s.durationMs > 0) &&
        (s.searchesCount > 0 ||
          (s.dishesViewed && Array.isArray(s.dishesViewed) && s.dishesViewed.length > 0) ||
          s.pickedDishId !== null)
    );

    // Count sessions that used Genio
    const genioEvents = await prisma.statEvent.findMany({
      where: {
        restaurantId: restaurant.id,
        createdAt: {
          gte: startDate,
          lt: endDate,
        },
        eventType: {
          in: ["GENIO_START", "GENIO_COMPLETE", "GENIO_DISH_ACCEPTED", "GENIO_DISH_REJECTED"],
        },
      },
      select: {
        sessionId: true,
      },
      distinct: ["sessionId"],
    });

    const genioSessionIds = new Set(genioEvents.map((e) => e.sessionId));
    const genioUsedCount = genioSessionIds.size;

    // Sessions with registered birthday
    const birthdaySessions = activeSessions.filter((s) => s.qrUser?.birthDate !== null);

    // Average session duration
    const sessionsWithDuration = activeSessions.filter((s) => s.durationMs && s.durationMs > 0);
    const totalDuration = sessionsWithDuration.reduce((sum, s) => sum + (s.durationMs || 0), 0);
    const avgDuration =
      sessionsWithDuration.length > 0
        ? Math.round(totalDuration / sessionsWithDuration.length)
        : 0;
    const avgDurationMinutes = Math.round(avgDuration / 1000 / 60);

    // Views breakdown
    const viewStats: { [key: string]: number } = {};
    const viewHistoryStats: { [key: string]: { count: number; totalDuration: number } } = {
      premium: { count: 0, totalDuration: 0 },
      lista: { count: 0, totalDuration: 0 },
      viaje: { count: 0, totalDuration: 0 },
    };

    for (const session of activeSessions) {
      if (session.viewUsed) {
        viewStats[session.viewUsed] = (viewStats[session.viewUsed] || 0) + 1;
      }

      if (session.viewHistory && Array.isArray(session.viewHistory)) {
        for (const view of session.viewHistory) {
          if (view.view && viewHistoryStats[view.view]) {
            viewHistoryStats[view.view].count++;
            if (view.durationMs) {
              viewHistoryStats[view.view].totalDuration += view.durationMs;
            }
          }
        }
      }
    }

    return {
      label,
      totalSessions: sessions.length,
      activeSessions: activeSessions.length,
      genioUsedCount,
      birthdayCount: birthdaySessions.length,
      avgDurationMinutes,
      avgDurationMs: avgDuration,
      viewStats,
      viewHistoryStats,
    };
  }

  // Analyze yesterday
  const yesterdayStats = await analyzeSessionsForDateRange(
    yesterday,
    today,
    "Yesterday (2026-04-24)"
  );

  // Analyze today
  const todayStats = await analyzeSessionsForDateRange(today, tomorrow, "Today (2026-04-25)");

  // Analyze combined
  const combinedStats = await analyzeSessionsForDateRange(yesterday, tomorrow, "Combined");

  // Print results
  const printStats = (stats: typeof yesterdayStats) => {
    console.log(`\n📅 ${stats.label}`);
    console.log("-".repeat(50));
    console.log(`  Total Sessions: ${stats.totalSessions}`);
    console.log(`  Sessions with Real Activity: ${stats.activeSessions}`);
    console.log(
      `  Used Genio: ${stats.genioUsedCount} (${stats.activeSessions > 0 ? ((stats.genioUsedCount / stats.activeSessions) * 100).toFixed(1) : 0}%)`
    );
    console.log(
      `  Birthday Registered: ${stats.birthdayCount} (${stats.activeSessions > 0 ? ((stats.birthdayCount / stats.activeSessions) * 100).toFixed(1) : 0}%)`
    );
    console.log(`  Avg Session Duration: ${stats.avgDurationMinutes} minutes (${stats.avgDurationMs}ms)`);

    console.log(`\n  📱 Views (last active):`);
    Object.entries(stats.viewStats).forEach(([view, count]) => {
      const pct = stats.activeSessions > 0 ? ((count / stats.activeSessions) * 100).toFixed(1) : "0";
      console.log(`    ${view}: ${count} (${pct}%)`);
    });

    console.log(`\n  ⏱️  View Time Breakdown:`);
    Object.entries(stats.viewHistoryStats).forEach(([view, data]) => {
      if (data.count > 0) {
        const avgMs = Math.round(data.totalDuration / data.count);
        const avgSec = Math.round(avgMs / 1000);
        console.log(`    ${view}: ${data.count} switches, avg ${avgSec}s per view`);
      }
    });
  };

  printStats(yesterdayStats);
  printStats(todayStats);
  printStats(combinedStats);

  // Summary comparison
  console.log("\n" + "=".repeat(60));
  console.log("📊 SUMMARY COMPARISON");
  console.log("=".repeat(60));
  console.log(`\n                   Yesterday    Today    Combined`);
  console.log(`Total Sessions:    ${String(yesterdayStats.totalSessions).padEnd(10)}${String(todayStats.totalSessions).padEnd(10)}${combinedStats.totalSessions}`);
  console.log(
    `Active Sessions:   ${String(yesterdayStats.activeSessions).padEnd(10)}${String(todayStats.activeSessions).padEnd(10)}${combinedStats.activeSessions}`
  );
  console.log(
    `Genio Used:        ${String(yesterdayStats.genioUsedCount).padEnd(10)}${String(todayStats.genioUsedCount).padEnd(10)}${combinedStats.genioUsedCount}`
  );
  console.log(
    `Birthday:          ${String(yesterdayStats.birthdayCount).padEnd(10)}${String(todayStats.birthdayCount).padEnd(10)}${combinedStats.birthdayCount}`
  );
  console.log(
    `Avg Duration (min):${String(yesterdayStats.avgDurationMinutes).padEnd(10)}${String(todayStats.avgDurationMinutes).padEnd(10)}${combinedStats.avgDurationMinutes}`
  );
  console.log("=".repeat(60) + "\n");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
