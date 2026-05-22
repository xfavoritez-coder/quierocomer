import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();

  // Canva provider
  const canva = await p.menuProvider.findFirst({ where: { name: "Canva" } });
  if (canva) {
    await p.menuProvider.update({
      where: { id: canva.id },
      data: {
        domainPatterns: ["canva.com", "www.canva.com"],
        htmlSignatures: ["canva.com/design", "canva-editor"],
        status: "SUPPORTED",
        notes: "Canva design links. Menu is a graphic design, not structured data. Uses Jina for text extraction, falls back to screenshot + Claude Vision.",
        extractionConfig: { preferVision: true },
      },
    });
    console.log(`Updated: Canva (${canva.id})`);
  } else {
    const created = await p.menuProvider.create({
      data: {
        name: "Canva",
        domainPatterns: ["canva.com", "www.canva.com"],
        htmlSignatures: ["canva.com/design", "canva-editor"],
        status: "SUPPORTED",
        notes: "Canva design links. Menu is a graphic design, not structured data. Uses Jina for text extraction, falls back to screenshot + Claude Vision.",
        extractionConfig: { preferVision: true },
      },
    });
    console.log(`Created: Canva (${created.id})`);
  }

  // Clean up old redirect providers (l.instagram, lm.facebook, etc.)
  const redirectProviders = await p.menuProvider.findMany({
    where: {
      OR: [
        { domainPatterns: { has: "l.instagram.com" } },
        { domainPatterns: { has: "lm.facebook.com" } },
        { name: { in: ["L.instagram", "Lm.facebook"] } },
      ],
    },
  });

  for (const rp of redirectProviders) {
    // Reassign leads to null (they'll get re-detected with resolved URL)
    const reassigned = await p.lead.updateMany({
      where: { detectedProviderId: rp.id },
      data: { detectedProviderId: null },
    });
    if (reassigned.count > 0) console.log(`Unlinked ${reassigned.count} leads from ${rp.name}`);
    await p.menuProvider.delete({ where: { id: rp.id } });
    console.log(`Deleted redirect provider: ${rp.name} (${rp.id})`);
  }

  // Fix La Parada Sureña: resolve its URL and reassign to Canva
  const parada = await p.lead.findFirst({
    where: { localName: { contains: "parada", mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
  });
  if (parada && parada.cartaUrl?.includes("l.instagram.com")) {
    // Extract real Canva URL from Instagram redirect
    try {
      const u = new URL(parada.cartaUrl);
      const realUrl = u.searchParams.get("u");
      if (realUrl && realUrl.includes("canva.com")) {
        const canvaProv = await p.menuProvider.findFirst({ where: { name: "Canva" } });
        await p.lead.update({
          where: { id: parada.id },
          data: {
            cartaUrl: realUrl,
            cartaStatus: "PENDING",
            errorLog: null,
            detectedProviderId: canvaProv?.id || null,
          },
        });
        console.log(`Fixed La Parada Sureña: URL resolved to Canva, reset to PENDING`);
      }
    } catch {}
  }

  console.log("\nDone.");
  await p.$disconnect();
}
main();
