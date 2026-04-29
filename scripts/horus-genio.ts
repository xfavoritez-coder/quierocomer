import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  const restaurant = await p.restaurant.findFirst({ where: { slug: "horusvegan" }, select: { id: true } });
  if (!restaurant) { console.log("No encontrado"); return; }

  const today = new Date("2026-04-25T00:00:00Z");
  const tomorrow = new Date("2026-04-26T00:00:00Z");

  // Get all genio events for this restaurant today
  const events = await p.statEvent.findMany({
    where: {
      restaurantId: restaurant.id,
      eventType: { in: ["GENIO_START", "GENIO_COMPLETE", "GENIO_STEP_DIET", "GENIO_STEP_RESTRICTIONS", "GENIO_STEP_DISLIKES"] },
      createdAt: { gte: today, lt: tomorrow },
    },
    select: { eventType: true, guestId: true, genioSessionId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  // Group by genioSessionId
  const bySession: Record<string, typeof events> = {};
  for (const e of events) {
    const key = e.genioSessionId || e.guestId;
    if (!bySession[key]) bySession[key] = [];
    bySession[key].push(e);
  }

  console.log(`Total genio sessions today: ${Object.keys(bySession).length}`);
  console.log("");

  let completed = 0;
  let abandoned = 0;
  const abandonedAt: Record<string, number> = {};

  for (const [id, evts] of Object.entries(bySession)) {
    const types = evts.map(e => e.eventType);
    const isComplete = types.includes("GENIO_COMPLETE");

    if (isComplete) {
      completed++;
    } else {
      abandoned++;
      const lastStep = types[types.length - 1];
      abandonedAt[lastStep] = (abandonedAt[lastStep] || 0) + 1;
    }

    // Show timeline
    const time = evts[0].createdAt.toISOString().slice(11, 16);
    const steps = types.map(t => t.replace("GENIO_", "")).join(" → ");
    console.log(`${time} | ${isComplete ? "✅" : "❌"} ${steps}`);
  }

  console.log("");
  console.log(`Completados: ${completed}`);
  console.log(`Abandonados: ${abandoned}`);
  if (Object.keys(abandonedAt).length > 0) {
    console.log("Abandonaron en:");
    for (const [step, count] of Object.entries(abandonedAt)) {
      console.log(`  ${step}: ${count}`);
    }
  }

  await p.$disconnect();
}
main();
