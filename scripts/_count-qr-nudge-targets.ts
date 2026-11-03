import { config } from "dotenv";
config({ path: ".env.prod" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const since = new Date("2026-09-02T00:01:00.000-03:00"); // 2 sep 00:01 hora Chile
  const nudgeWindowStart = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  const leads = await prisma.lead.findMany({
    where: {
      cartaStatus: "DELIVERED",
      deliveredAt: { lte: nudgeWindowStart },
      email: { not: "" },
      createdAt: { gte: since },
    },
    select: { id: true, email: true, ownerName: true, localName: true, createdAt: true, deliveredAt: true, events: true },
    orderBy: { createdAt: "asc" },
  });

  const pending = leads.filter(l => {
    const events = Array.isArray(l.events) ? l.events as any[] : [];
    return !events.some((e: any) => e.type === "qr_nudge_sent");
  });

  console.log(`Total desde 2-sep con carta entregada hace +3 días: ${leads.length}`);
  console.log(`Sin nudge enviado: ${pending.length}\n`);
  pending.forEach(l => {
    console.log(`  ${(l.localName || "").padEnd(30)} | ${l.email} | creado: ${l.createdAt.toISOString().slice(0,10)}`);
  });

  await prisma.$disconnect();
}
main().catch(console.error);
