import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  const r = await p.restaurant.findFirst({
    where: { name: { contains: "alleria", mode: "insensitive" } },
    select: { id: true, name: true, plan: true, subscriptionStatus: true },
  });
  if (!r) { console.log("No encontrado"); return; }
  console.log(`${r.name} | plan: ${r.plan} | status: ${r.subscriptionStatus}`);

  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const todayStart = new Date("2026-07-09T00:00:00.000-04:00");

  const [todaySess, weekSess, weekEvents] = await Promise.all([
    p.session.count({ where: { restaurantId: r.id, startedAt: { gte: todayStart } } }),
    p.session.count({ where: { restaurantId: r.id, startedAt: { gte: weekAgo } } }),
    p.statEvent.count({ where: { restaurantId: r.id, eventType: "SESSION_START", createdAt: { gte: weekAgo } } }),
  ]);

  console.log("Sessions hoy:", todaySess);
  console.log("Sessions esta semana:", weekSess);
  console.log("StatEvents SESSION_START semana:", weekEvents);

  const last = await p.session.findFirst({
    where: { restaurantId: r.id },
    orderBy: { startedAt: "desc" },
    select: { startedAt: true },
  });
  console.log("Ultima sesion:", last?.startedAt ?? "Nunca");
}

main().catch(console.error).finally(() => p.$disconnect());
