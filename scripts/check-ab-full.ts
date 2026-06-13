import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();

  for (const exp of ["landing-hero", "subircarta-hero"]) {
    const experiment = await p.abExperiment.findUnique({ where: { slug: exp }, include: { variants: true } });
    if (!experiment) continue;

    const impEvent = exp === "landing-hero" ? "LANDING_VIEWED" : "SUBIRCARTA_VIEWED";
    const convEvent = exp === "landing-hero" ? "LANDING_CTA_CLICK" : "SUBIRCARTA_CARTA_UPLOADED";

    const events = await (p as any).statEvent.findMany({
      where: { eventType: { in: [impEvent, convEvent] }, metadata: { path: ["abExperiment"], equals: exp } },
      select: { eventType: true, metadata: true },
    });

    const stats = new Map<string, { imp: number; conv: number }>();
    for (const e of events) {
      const m = e.metadata as any;
      for (const slot of ["title", "subtitle", "cta"]) {
        const id = m?.[`${slot}Id`];
        if (!id) continue;
        let b = stats.get(id);
        if (!b) { b = { imp: 0, conv: 0 }; stats.set(id, b); }
        if (e.eventType === impEvent) b.imp++;
        else b.conv++;
      }
    }

    console.log(`\n=== ${exp} (${events.length} events) ===`);
    for (const slot of ["title", "subtitle", "cta"]) {
      const slotVars = experiment.variants.filter((v: any) => v.slot === slot);
      if (slotVars.length === 0) continue;
      console.log(`  ${slot.toUpperCase()}:`);
      for (const v of slotVars) {
        const s = stats.get(v.id) || { imp: 0, conv: 0 };
        const cr = s.imp > 0 ? Math.round((s.conv / s.imp) * 100) : 0;
        const share = events.filter((e: any) => e.eventType === impEvent).length;
        const pct = share > 0 ? Math.round((s.imp / (share / (slot === "title" ? 1 : 1))) * 100) : 0;
        console.log(`    ${v.isActive ? "✓" : "✗"} "${v.text.slice(0, 45)}" | imp: ${s.imp} | conv: ${s.conv} | CR: ${cr}% | traffic: ~${pct}%`);
      }
    }
  }

  await p.$disconnect();
}
main();
