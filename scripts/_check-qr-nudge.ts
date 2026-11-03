import { config } from "dotenv";
config({ path: ".env.prod" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const leads = await prisma.lead.findMany({
    select: { id: true, email: true, ownerName: true, localName: true, events: true },
  });

  const nudged = leads.filter((l: any) => {
    const events = Array.isArray(l.events) ? l.events : [];
    return events.some((e: any) => e.type === "qr_nudge_sent");
  });

  console.log(`Total enviados: ${nudged.length}`);
  nudged.forEach((l: any) => {
    const ev = (l.events as any[]).find((e: any) => e.type === "qr_nudge_sent");
    console.log(`  ${(l.localName || "").padEnd(30)} | ${(l.ownerName || "").padEnd(20)} | ${l.email || ""} | ${ev?.at?.slice(0,10) || ""}`);
  });

  await prisma.$disconnect();
}
main().catch(console.error);
