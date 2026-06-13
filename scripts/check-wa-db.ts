import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const msgCount = await p.$queryRaw`SELECT COUNT(*) as c FROM "WhatsAppMessage"` as any[];
  console.log("WhatsAppMessage rows:", msgCount[0]?.c);

  const leadCount = await p.lead.count({ where: { whatsappSentAt: { not: null } } });
  console.log("Leads with whatsappSentAt:", leadCount);

  // Test the exact query the admin uses
  const leads = await p.lead.findMany({
    where: { whatsappSentAt: { not: null } },
    select: { id: true, localName: true, whatsappSentAt: true },
    take: 3,
  });
  console.log("Sample leads:", leads.map(l => l.localName).join(", "));

  await p.$disconnect();
}
main();
