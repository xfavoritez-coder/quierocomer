import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();

  const total = await p.lead.count({ where: { activarVisitedAt: { not: null } } });
  const activated = await p.lead.count({ where: { activatedAt: { not: null } } });
  const dropped = total - activated;

  console.log(`Visitaron /activar: ${total}`);
  console.log(`Activaron: ${activated} (${Math.round(activated/total*100)}%)`);
  console.log(`Abandonaron: ${dropped} (${Math.round(dropped/total*100)}%)`);

  // Los que visitaron pero no activaron
  const dropoffs = await p.lead.findMany({
    where: { activarVisitedAt: { not: null }, activatedAt: null },
    select: { localName: true, ownerName: true, email: true, activarVisitedAt: true, onboardingDoneAt: true, panelVisitedAt: true },
    orderBy: { activarVisitedAt: "desc" },
  });
  console.log("\nDropoffs:");
  for (const l of dropoffs) {
    console.log(`  ${l.localName} | ${l.ownerName} | onboard: ${l.onboardingDoneAt ? "✓" : "✗"} | panel: ${l.panelVisitedAt ? "✓" : "✗"} | visitó: ${l.activarVisitedAt?.toISOString().slice(0, 16)}`);
  }

  await p.$disconnect();
}
main();
