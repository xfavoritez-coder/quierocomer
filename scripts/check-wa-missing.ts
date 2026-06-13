import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  // Leads delivered but no WA sent, regardless of email open status
  const leads = await p.lead.findMany({
    where: {
      deliveredAt: { not: null },
      whatsapp: { not: null },
      whatsappSentAt: null,
    },
    select: { localName: true, ownerName: true, whatsapp: true, email: true, emailOpenedAt: true, generatedSlug: true },
    orderBy: { createdAt: "desc" },
  });
  console.log(`Leads with WA but no WA sent: ${leads.length}`);
  for (const l of leads) {
    console.log(`  ${l.localName} | ${l.ownerName} | WA: ${l.whatsapp} | email: ${l.email} | opened: ${l.emailOpenedAt ? "YES" : "NO"} | slug: ${l.generatedSlug}`);
  }
  await p.$disconnect();
}
main();
