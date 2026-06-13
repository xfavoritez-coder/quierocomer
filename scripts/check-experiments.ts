import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const exps = await p.abExperiment.findMany({ include: { variants: true } });
  if (exps.length === 0) {
    console.log("NO EXPERIMENTS IN DB — need to re-seed");
  }
  for (const e of exps) {
    console.log(`${e.slug} | active: ${e.isActive} | variants: ${e.variants.length}`);
    for (const v of e.variants) console.log(`  [${v.slot}] ${v.isActive ? "✓" : "✗"} "${v.text}"`);
  }
  await p.$disconnect();
}
main();
