import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();

  const existing = await p.abExperiment.findUnique({ where: { slug: "subircarta-hero" } });
  if (existing) {
    console.log("Experiment already exists:", existing.id);
    const variants = await p.abVariant.findMany({ where: { experimentId: existing.id } });
    for (const v of variants) console.log(`  [${v.slot}] ${v.text}`);
    await p.$disconnect();
    return;
  }

  await p.abExperiment.create({
    data: {
      slug: "subircarta-hero",
      name: "Subir Carta Hero",
      isActive: true,
      variants: {
        create: [
          { slot: "title", text: "Sube tu carta y mira cómo queda" },
          { slot: "title", text: "Transforma tu carta en 60 segundos" },
          { slot: "title", text: "Tu carta, pero inteligente" },
          { slot: "cta", text: "Comenzar →" },
          { slot: "cta", text: "Subir mi carta →" },
          { slot: "cta", text: "Ver cómo queda →" },
        ],
      },
    },
  });
  console.log("Created subircarta-hero experiment with 6 variants");

  // Also reset the second landing title variant that has 0 impressions
  const landingExp = await p.abExperiment.findUnique({ where: { slug: "landing-hero" }, include: { variants: true } });
  if (landingExp) {
    const zeroTitle = landingExp.variants.find(v => v.slot === "title" && v.text.includes("restaurant"));
    if (zeroTitle) {
      // It was never shown because Thompson Sampling never picked it. The fix in sampling.ts
      // (min impressions) will now ensure it gets at least 20 impressions.
      console.log(`Landing title variant "${zeroTitle.text}" has 0 impressions — sampling fix will force exploration`);
    }
  }

  await p.$disconnect();
}
main();
