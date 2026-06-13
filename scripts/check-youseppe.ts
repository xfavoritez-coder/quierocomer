import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const leads = await p.lead.findMany({
    where: { localName: { contains: "youseppe", mode: "insensitive" } },
    select: {
      id: true, localName: true, cartaStatus: true, cartaUrl: true,
      cartaFileUrl: true, cartaType: true, errorLog: true,
      detectedProviderId: true, createdAt: true, email: true,
      events: true, generatedSlug: true
    },
  });
  console.log(JSON.stringify(leads, null, 2));
  await p.$disconnect();
}
main();
