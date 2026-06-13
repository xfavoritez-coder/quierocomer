import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const demos = await p.restaurant.findMany({ where: { isDemo: true }, select: { slug: true, name: true }, take: 5 });
  for (const d of demos) console.log(`${d.slug} — ${d.name}`);
  if (!demos.length) {
    const any = await p.restaurant.findMany({ select: { slug: true, name: true, isDemo: true }, take: 5, orderBy: { createdAt: "desc" } });
    console.log("No demos, recent:");
    for (const d of any) console.log(`${d.slug} — ${d.name} (demo: ${d.isDemo})`);
  }
  await p.$disconnect();
}
main();
