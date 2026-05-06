import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const r = await prisma.restaurant.findFirst({ where: { slug: "hand-roll" } });
  if (!r) return;

  // Top guests por # de sesiones en Hand Roll
  const topGuests = await prisma.session.groupBy({
    by: ["guestId"],
    where: { restaurantId: r.id },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 15,
  });

  console.log(`Top 15 guests con más sesiones en Hand Roll:\n`);
  for (const g of topGuests) {
    // Detalles del guest
    const sessions = await prisma.session.findMany({
      where: { guestId: g.guestId, restaurantId: r.id },
      select: { startedAt: true, durationMs: true, dishesViewed: true, qrUserId: true, ipAddress: true, userAgent: true, isBot: true, deviceType: true },
      orderBy: { startedAt: "desc" },
    });
    const first = sessions[sessions.length - 1];
    const last = sessions[0];
    const days = new Set(sessions.map(s => s.startedAt.toISOString().split("T")[0])).size;
    const totalMs = sessions.reduce((sum, s) => sum + (s.durationMs || 0), 0);
    const avgMin = sessions.length ? Math.round(totalMs / sessions.length / 60000) : 0;
    const linked = sessions.find(s => s.qrUserId)?.qrUserId;
    const bots = sessions.filter(s => s.isBot).length;
    const ips = new Set(sessions.map(s => s.ipAddress).filter(Boolean));
    const devices = new Set(sessions.map(s => s.deviceType).filter(Boolean));

    console.log(`Guest ${g.guestId.substring(0, 12)}... ${g._count.id}x sesiones, ${days} días distintos`);
    console.log(`  Primera: ${first.startedAt.toISOString().split("T")[0]} | Última: ${last.startedAt.toISOString().split("T")[0]}`);
    console.log(`  Avg dur: ${avgMin} min | Bots: ${bots}/${sessions.length} | IPs: ${ips.size} | Devices: ${[...devices].join(",") || "-"}`);
    console.log(`  qrUser: ${linked || "no"}`);
    console.log("");
  }

  // Cuántas sesiones totales hay y cuántos guests únicos
  const total = await prisma.session.count({ where: { restaurantId: r.id } });
  const unique = await prisma.session.groupBy({ by: ["guestId"], where: { restaurantId: r.id } });
  console.log(`\nTotal: ${total} sesiones, ${unique.length} guests únicos`);
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
