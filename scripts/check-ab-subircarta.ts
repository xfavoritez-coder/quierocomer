import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();

  // Check subircarta events
  const viewed = await p.statEvent.count({ where: { eventType: "SUBIRCARTA_VIEWED" as any } });
  const uploaded = await p.statEvent.count({ where: { eventType: "SUBIRCARTA_CARTA_UPLOADED" as any } });
  const landingLeads = await p.statEvent.count({ where: { eventType: "LANDING_LEAD_CREATED" as any } });

  console.log("SUBIRCARTA_VIEWED:", viewed);
  console.log("SUBIRCARTA_CARTA_UPLOADED:", uploaded);
  console.log("LANDING_LEAD_CREATED:", landingLeads);

  // Check if events have abExperiment metadata
  const scEvents = await p.statEvent.findMany({
    where: { eventType: { in: ["SUBIRCARTA_VIEWED", "SUBIRCARTA_CARTA_UPLOADED"] as any } },
    select: { eventType: true, metadata: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  console.log("\nRecent subircarta events:", scEvents.length);
  for (const e of scEvents) {
    console.log(`  ${e.eventType} | ${e.createdAt.toISOString().slice(0, 16)} | meta: ${JSON.stringify(e.metadata)}`);
  }

  await p.$disconnect();
}
main();
