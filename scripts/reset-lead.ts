import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const query = process.argv[2] || "parada";
  const lead = await p.lead.findFirst({
    where: { localName: { contains: query, mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
  });
  if (!lead) { console.log(`No lead with "${query}"`); await p.$disconnect(); return; }
  await p.lead.update({
    where: { id: lead.id },
    data: { cartaStatus: "PENDING", errorLog: null },
  });
  console.log(`Reset "${lead.localName}" to PENDING`);
  await p.$disconnect();
}
main();
