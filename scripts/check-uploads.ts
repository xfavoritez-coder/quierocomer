import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
async function main() {
  const p = new PrismaClient();
  const uploads = await (p as any).statEvent.findMany({
    where: { eventType: "SUBIRCARTA_CARTA_UPLOADED" },
    select: { metadata: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 15,
  });
  console.log("Uploads:", uploads.length);
  for (const u of uploads) {
    const m = u.metadata as any;
    console.log(`  ${u.createdAt.toISOString().slice(0, 16)} | exp: ${m?.abExperiment || "NONE"} | title: ${m?.titleId?.slice(-6) || "NONE"}`);
  }
  await p.$disconnect();
}
main();
