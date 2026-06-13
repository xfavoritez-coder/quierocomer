import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();

  const exp = await p.abExperiment.findUnique({
    where: { slug: "landing-hero" },
    include: { variants: { orderBy: { createdAt: "asc" } } },
  });
  if (!exp) { console.log("No experiment"); await p.$disconnect(); return; }

  console.log(`${exp.name} | active: ${exp.isActive}\n`);

  const events = await p.statEvent.findMany({
    where: {
      eventType: { in: ["LANDING_VIEWED", "LANDING_CTA_CLICK"] },
      metadata: { path: ["abExperiment"], equals: "landing-hero" },
    },
    select: { eventType: true, metadata: true },
  });

  const stats = new Map<string, { imp: number; conv: number }>();
  for (const e of events) {
    const m = e.metadata as any;
    if (!m) continue;
    for (const slot of ["title", "subtitle", "cta"]) {
      const id = m[`${slot}Id`];
      if (!id) continue;
      let b = stats.get(id);
      if (!b) { b = { imp: 0, conv: 0 }; stats.set(id, b); }
      if (e.eventType === "LANDING_VIEWED") b.imp++;
      else b.conv++;
    }
  }

  for (const slot of ["title", "subtitle", "cta"]) {
    console.log(`--- ${slot.toUpperCase()} ---`);
    const slotVars = exp.variants.filter(v => v.slot === slot);
    for (const v of slotVars) {
      const s = stats.get(v.id) || { imp: 0, conv: 0 };
      const cr = s.imp > 0 ? Math.round((s.conv / s.imp) * 100) : 0;
      console.log(`  ${v.isActive ? "✓" : "✗"} "${v.text.slice(0, 50)}" | imp: ${s.imp} | conv: ${s.conv} | CR: ${cr}%`);
    }
  }

  console.log(`\nTotal events: ${events.length} (${events.filter(e => e.eventType === "LANDING_VIEWED").length} views, ${events.filter(e => e.eventType === "LANDING_CTA_CLICK").length} clicks)`);
  await p.$disconnect();
}
main();
