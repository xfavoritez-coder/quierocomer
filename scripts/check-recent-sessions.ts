import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  // Last 30 minutes of sessions
  const since = new Date(Date.now() - 30 * 60 * 1000);

  const sessions = await p.session.findMany({
    where: { startedAt: { gte: since } },
    select: {
      id: true, guestId: true, startedAt: true, durationMs: true,
      dishesViewed: true, categoriesViewed: true, viewUsed: true,
      deviceType: true, userAgent: true, isBot: true, isQrScan: true,
      restaurant: { select: { name: true, slug: true } },
    },
    orderBy: { startedAt: "desc" },
  });

  console.log(`Sesiones en los últimos 30 min: ${sessions.length}\n`);

  // Group by guest
  const byGuest: Record<string, typeof sessions> = {};
  for (const s of sessions) {
    if (!byGuest[s.guestId]) byGuest[s.guestId] = [];
    byGuest[s.guestId].push(s);
  }

  // Find guests with multiple sessions
  const multi = Object.entries(byGuest).filter(([, ss]) => ss.length > 1);
  if (multi.length > 0) {
    console.log(`Guests con múltiples sesiones:\n`);
    for (const [guestId, ss] of multi.sort((a, b) => b[1].length - a[1].length)) {
      console.log(`  ${guestId.slice(0, 12)} → ${ss.length} sesiones en ${ss[0].restaurant.name}`);
      for (const s of ss) {
        const dishes = (s.dishesViewed as any[])?.length || 0;
        const cats = (s.categoriesViewed as any[])?.length || 0;
        const time = s.startedAt.toISOString().slice(11, 19);
        console.log(`    ${time} | ${s.durationMs ? Math.round(s.durationMs/1000) + 's' : '—'} | ${dishes} platos | ${cats} cats | ${s.viewUsed || '—'} | ${s.deviceType}`);
      }
    }
  }

  // Group by restaurant
  const byRest: Record<string, number> = {};
  for (const s of sessions) {
    byRest[s.restaurant.name] = (byRest[s.restaurant.name] || 0) + 1;
  }
  console.log(`\nPor restaurante:`);
  for (const [name, count] of Object.entries(byRest).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${name}: ${count}`);
  }

  // Check for rapid-fire sessions (same guest, <30s apart)
  console.log(`\nSesiones sospechosas (mismo guest, <30s entre sí):`);
  let suspicious = 0;
  for (const [guestId, ss] of Object.entries(byGuest)) {
    const sorted = ss.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i].startedAt.getTime() - sorted[i-1].startedAt.getTime();
      if (gap < 30000) {
        suspicious++;
        console.log(`  ${guestId.slice(0, 12)} | gap: ${Math.round(gap/1000)}s | ${sorted[i].restaurant.name}`);
      }
    }
  }
  if (suspicious === 0) console.log("  Ninguna");

  // Total today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const totalToday = await p.session.count({ where: { startedAt: { gte: todayStart } } });
  const totalLastHour = await p.session.count({ where: { startedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } } });
  console.log(`\nTotal hoy: ${totalToday} | Última hora: ${totalLastHour}`);

  await p.$disconnect();
}
main();
