import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  const leads = await p.lead.findMany({
    where: { localName: { contains: "fog", mode: "insensitive" } },
    select: { id: true, ownerName: true, localName: true, whatsapp: true },
  });
  console.log("LEADS:", JSON.stringify(leads, null, 2));

  const msgs = await p.whatsAppMessage.findMany({
    where: { profileName: { contains: "fog", mode: "insensitive" } },
    select: { phone: true, profileName: true },
    distinct: ["phone"],
  });
  console.log("PHONES by profileName:", JSON.stringify(msgs, null, 2));

  const recent = await p.whatsAppMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    distinct: ["phone"],
    select: { phone: true, profileName: true, createdAt: true, direction: true },
  });
  console.log("\nRecent distinct phones:");
  for (const r of recent) {
    console.log("  " + r.phone + " | " + (r.profileName || "?") + " | " + r.createdAt.toISOString() + " | " + r.direction);
  }

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
