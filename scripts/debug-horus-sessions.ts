/**
 * Diagnostico de sesiones, recurrentes y registrados para Horus.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const horus = await prisma.restaurant.findFirst({ where: { slug: "horusvegan" }, select: { id: true, name: true } });
  if (!horus) { console.log("Horus no encontrado"); return; }
  console.log(`Restaurant: ${horus.name} (${horus.id})\n`);

  // Ultimos 30 dias
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sessions = await prisma.session.findMany({
    where: { restaurantId: horus.id, startedAt: { gte: from } },
    select: {
      id: true, guestId: true, qrUserId: true, startedAt: true,
      isReturningVisitor: true, converted: true,
      dishesViewed: true, categoriesViewed: true,
    },
    orderBy: { startedAt: "desc" },
  });

  console.log(`Total sesiones (30 dias): ${sessions.length}`);
  const uniqueGuests = new Set(sessions.map(s => s.guestId));
  console.log(`Guests unicos: ${uniqueGuests.size}`);

  const returning = sessions.filter(s => s.isReturningVisitor);
  console.log(`Sesiones con isReturningVisitor=true: ${returning.length}`);

  const converted = sessions.filter(s => s.converted);
  console.log(`Sesiones con converted=true: ${converted.length}`);

  const withQrUser = sessions.filter(s => s.qrUserId);
  console.log(`Sesiones con qrUserId (registrado): ${withQrUser.length}`);

  // Sesiones vacias (sin platos ni categorias)
  const emptySessions = sessions.filter(s => {
    const dv = (s.dishesViewed as any[]) || [];
    const cv = (s.categoriesViewed as any[]) || [];
    return dv.length === 0 && cv.length === 0;
  });
  console.log(`Sesiones vacias (0 platos, 0 categorias): ${emptySessions.length}`);

  // Guests con mas de 1 sesion
  const guestSessionCounts = new Map<string, number>();
  for (const s of sessions) {
    guestSessionCounts.set(s.guestId, (guestSessionCounts.get(s.guestId) || 0) + 1);
  }
  const guestsWithMultiple = [...guestSessionCounts.entries()].filter(([, c]) => c > 1);
  console.log(`Guests con >1 sesion: ${guestsWithMultiple.length}`);

  // GuestProfile.visitCount
  if (uniqueGuests.size > 0) {
    const guests = await prisma.guestProfile.findMany({
      where: { id: { in: [...uniqueGuests] } },
      select: { id: true, visitCount: true, convertedToUserAt: true, linkedQrUserId: true },
    });
    const visitCountStats = guests.reduce((acc, g) => {
      const range = g.visitCount === 1 ? "1" : g.visitCount <= 3 ? "2-3" : g.visitCount <= 10 ? "4-10" : "10+";
      acc[range] = (acc[range] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log(`\nDistribucion de visitCount (de GuestProfile):`);
    for (const [range, count] of Object.entries(visitCountStats)) {
      console.log(`  ${range} visitas: ${count} guests`);
    }
    const convertedGuests = guests.filter(g => g.convertedToUserAt).length;
    console.log(`\nGuests convertidos (con convertedToUserAt): ${convertedGuests}`);
    const linkedToUser = guests.filter(g => g.linkedQrUserId).length;
    console.log(`Guests vinculados a un QRUser: ${linkedToUser}`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
