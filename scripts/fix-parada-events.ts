import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const lead = await p.lead.findFirst({
    where: { localName: { contains: "parada", mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
  });
  if (!lead) { console.log("Not found"); await p.$disconnect(); return; }

  // Remove onboarding and abandonment events (those were from admin testing)
  const events = (lead.events as any[] || []).filter((e: any) =>
    !e.action?.startsWith("onboard_") &&
    !e.action?.startsWith("abandoned_") &&
    !e.action?.startsWith("panel_")
  );

  await p.lead.update({
    where: { id: lead.id },
    data: { events },
  });

  console.log(`Cleaned events: ${(lead.events as any[]).length} → ${events.length}`);
  await p.$disconnect();
}
main();
