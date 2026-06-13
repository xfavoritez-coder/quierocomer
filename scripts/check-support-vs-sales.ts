import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const restaurants = await p.restaurant.findMany({
    where: { ownerId: { not: null }, isDemo: false },
    select: { id: true, name: true, plan: true, owner: { select: { whatsapp: true } } },
  });

  const sessions = await p.session.groupBy({
    by: ["restaurantId"],
    where: { startedAt: { gte: sevenDaysAgo } },
    _count: true,
  });
  const sessionMap = new Map(sessions.map(s => [s.restaurantId, s._count]));

  const support: string[] = [];
  const sales: string[] = [];

  for (const r of restaurants) {
    const count = sessionMap.get(r.id) || 0;
    if (count >= 3) {
      support.push(`  [SUPPORT] ${r.name} | plan=${r.plan} | sessions7d=${count}`);
    } else {
      sales.push(`  [SALES]   ${r.name} | plan=${r.plan} | sessions7d=${count}`);
    }
  }

  console.log(`=== SUPPORT (${support.length}) — clientes reales usando la carta ===`);
  for (const s of support) console.log(s);

  console.log(`\n=== SALES (${sales.length}) — Camila ventas/reactivacion ===`);
  for (const s of sales) console.log(s);

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
