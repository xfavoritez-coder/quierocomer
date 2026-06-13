/**
 * Ver resultados de la campaña de reactivación.
 * Muestra: enviados, abiertos, clickeados, y qué hizo cada persona después.
 *
 * Uso: npx tsx scripts/check-reactivation-results.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const logs = await p.emailLog.findMany({
    where: { purpose: "reactivation" },
    orderBy: { createdAt: "asc" },
  });

  const total = logs.length;
  const sent = logs.filter(l => l.status === "sent").length;
  const failed = logs.filter(l => l.status === "failed").length;
  const opened = logs.filter(l => l.openedAt).length;
  const clicked = logs.filter(l => l.clickedAt).length;

  console.log("═".repeat(50));
  console.log("  RESULTADOS CAMPAÑA REACTIVACIÓN");
  console.log("═".repeat(50));
  console.log(`  Total emails: ${total}`);
  console.log(`  Enviados:     ${sent}`);
  console.log(`  Fallidos:     ${failed}`);
  console.log(`  Abiertos:     ${opened} (${total > 0 ? ((opened / sent) * 100).toFixed(1) : 0}%)`);
  console.log(`  Clickeados:   ${clicked} (${total > 0 ? ((clicked / sent) * 100).toFixed(1) : 0}%)`);

  console.log("\n── DETALLE POR EMAIL ──\n");

  for (const log of logs) {
    const status = log.status === "failed" ? "❌ FAIL" :
      log.clickedAt ? "🔥 CLICK" :
      log.openedAt ? "👀 OPEN" : "📧 sent";

    const openTime = log.openedAt
      ? ` (abierto ${timeDiff(log.createdAt, log.openedAt)})`
      : "";
    const clickTime = log.clickedAt
      ? ` (click ${timeDiff(log.createdAt, log.clickedAt)})`
      : "";

    // Find lead by email
    const lead = await p.lead.findFirst({
      where: { email: log.to },
      select: { localName: true, activatedAt: true, panelVisitedAt: true },
    });

    const postAction = [];
    if (lead?.activatedAt && lead.activatedAt > log.createdAt) postAction.push("ACTIVÓ");
    if (lead?.panelVisitedAt && lead.panelVisitedAt > log.createdAt) postAction.push("visitó panel");

    console.log(`  ${status.padEnd(10)} ${(lead?.localName || log.to).padEnd(30)} ${log.to}${openTime}${clickTime}${postAction.length ? " → " + postAction.join(", ") : ""}`);
  }

  await p.$disconnect();
}

function timeDiff(from: Date, to: Date): string {
  const mins = Math.floor((to.getTime() - from.getTime()) / 60000);
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

main().catch(console.error);
