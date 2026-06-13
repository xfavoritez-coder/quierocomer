import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const lead = await prisma.lead.findFirst({
    where: { generatedSlug: "taranta-chicureo" },
    select: { id: true, cartaStatus: true, cartaType: true, cartaUrl: true, cartaFileUrl: true, detectedProviderId: true, errorLog: true },
  });
  console.log("=== LEAD ===");
  console.log(JSON.stringify(lead, null, 2));
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
