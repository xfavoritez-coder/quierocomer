import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const result = await p.lead.updateMany({
    where: { whatsappSentAt: { not: null } },
    data: { whatsappSentAt: null, whatsappClickedAt: null },
  });
  console.log(`Cleared WA timestamps from ${result.count} leads`);
  await p.$disconnect();
}
main();
