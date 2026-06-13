import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();

  const events = await p.$queryRaw`
    SELECT "eventType", metadata FROM "StatEvent"
    WHERE "eventType" IN ('SUBIRCARTA_VIEWED', 'SUBIRCARTA_CARTA_UPLOADED')
    AND metadata->>'abExperiment' = 'subircarta-hero'
  ` as any[];

  console.log("Raw query returned:", events.length, "events");
  const views = events.filter((e: any) => e.eventType === "SUBIRCARTA_VIEWED").length;
  const uploads = events.filter((e: any) => e.eventType === "SUBIRCARTA_CARTA_UPLOADED").length;
  console.log("Views:", views, "Uploads:", uploads);

  await p.$disconnect();
}
main();
