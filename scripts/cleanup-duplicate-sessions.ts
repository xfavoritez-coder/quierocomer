import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find all sessions today grouped by guest
  const sessions = await p.session.findMany({
    where: { startedAt: { gte: today } },
    select: { id: true, guestId: true, startedAt: true, durationMs: true, dishesViewed: true, categoriesViewed: true },
    orderBy: { startedAt: "asc" },
  });

  const byGuest: Record<string, typeof sessions> = {};
  for (const s of sessions) {
    if (!byGuest[s.guestId]) byGuest[s.guestId] = [];
    byGuest[s.guestId].push(s);
  }

  const toDelete: string[] = [];

  for (const [guestId, guestSessions] of Object.entries(byGuest)) {
    if (guestSessions.length <= 1) continue;

    // Find sessions that are <5 min apart from the previous one — those are duplicates
    for (let i = 1; i < guestSessions.length; i++) {
      const gap = guestSessions[i].startedAt.getTime() - guestSessions[i - 1].startedAt.getTime();
      if (gap < 5 * 60 * 1000) {
        // Keep the one with more data (more dishes viewed)
        const prevDishes = (guestSessions[i - 1].dishesViewed as any[])?.length || 0;
        const currDishes = (guestSessions[i].dishesViewed as any[])?.length || 0;
        const prevDuration = guestSessions[i - 1].durationMs || 0;
        const currDuration = guestSessions[i].durationMs || 0;

        // Delete the shorter/emptier one
        if (currDishes > prevDishes || (currDishes === prevDishes && currDuration > prevDuration)) {
          toDelete.push(guestSessions[i - 1].id);
        } else {
          toDelete.push(guestSessions[i].id);
        }
      }
    }
  }

  console.log(`Total sesiones hoy: ${sessions.length}`);
  console.log(`Duplicadas a borrar: ${toDelete.length}`);

  if (toDelete.length > 0) {
    const deleted = await p.session.deleteMany({ where: { id: { in: toDelete } } });
    console.log(`Borradas: ${deleted.count}`);
  }

  const remaining = await p.session.count({ where: { startedAt: { gte: today } } });
  console.log(`Restantes hoy: ${remaining}`);

  await p.$disconnect();
}
main();
