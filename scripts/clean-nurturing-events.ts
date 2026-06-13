/**
 * One-time script: Remove all fake nurturing events from Lead.events
 * These events have action starting with "nurturing_" but the messages never actually arrived.
 *
 * Usage: npx tsx scripts/clean-nurturing-events.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Find all leads that have nurturing events
  const leads = await prisma.lead.findMany({
    where: {
      events: { isEmpty: false },
    },
    select: { id: true, localName: true, events: true },
  });

  let totalRemoved = 0;
  let leadsUpdated = 0;

  for (const lead of leads) {
    const events = Array.isArray(lead.events) ? (lead.events as any[]) : [];
    const nurturingEvents = events.filter((e: any) => typeof e.action === "string" && e.action.startsWith("nurturing_"));

    if (nurturingEvents.length === 0) continue;

    const cleanEvents = events.filter((e: any) => !(typeof e.action === "string" && e.action.startsWith("nurturing_")));

    await prisma.lead.update({
      where: { id: lead.id },
      data: { events: cleanEvents as any },
    });

    totalRemoved += nurturingEvents.length;
    leadsUpdated++;
    console.log(`  ${lead.localName}: removed ${nurturingEvents.length} nurturing events (${events.length} -> ${cleanEvents.length})`);
  }

  console.log(`\nDone: removed ${totalRemoved} fake nurturing events from ${leadsUpdated} leads.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
