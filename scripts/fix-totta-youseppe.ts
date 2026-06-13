import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();

  // 1. Create/update OlaClick provider
  const olaClickProvider = await p.menuProvider.upsert({
    where: { id: "olaclick" },
    create: {
      id: "olaclick",
      name: "OlaClick",
      domainPatterns: ["ola.click"],
      htmlSignatures: ["olaclick", "__NUXT__", "olaClick"],
      status: "SUPPORTED",
      extractionConfig: { useJina: true, waitForSelector: ".infinite-products" },
      notes: "Vue.js/Nuxt SPA. Products load dynamically. Uses Jina with X-Wait-For-Selector to render. Menu at /products path.",
      successCount: 0,
      failCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    update: {
      name: "OlaClick",
      domainPatterns: ["ola.click"],
      htmlSignatures: ["olaclick", "__NUXT__", "olaClick"],
      status: "SUPPORTED",
      extractionConfig: { useJina: true, waitForSelector: ".infinite-products" },
      notes: "Vue.js/Nuxt SPA. Products load dynamically. Uses Jina with X-Wait-For-Selector to render. Menu at /products path.",
      updatedAt: new Date(),
    },
  });
  console.log("OlaClick provider:", olaClickProvider.id, "- status:", olaClickProvider.status);

  // 2. Reset La Totta lead to PENDING and assign OlaClick provider
  const totta = await p.lead.update({
    where: { id: "cmpu7bkb4000ijr04b22qx37d" },
    data: {
      cartaStatus: "PENDING",
      errorLog: null,
      detectedProviderId: olaClickProvider.id,
    },
  });
  console.log("La Totta reset to PENDING, provider:", olaClickProvider.id);

  // 3. Check Youseppe
  const youseppe = await p.lead.findFirst({
    where: { localName: { contains: "youseppe", mode: "insensitive" } },
    select: { id: true, localName: true, cartaUrl: true, cartaStatus: true, errorLog: true },
  });
  if (youseppe) {
    console.log("\nYouseppe:", youseppe.cartaStatus, "| URL:", youseppe.cartaUrl, "| Error:", youseppe.errorLog);
    // Reset Youseppe too - it's a website, the scraper needs to discover the menu
    await p.lead.update({
      where: { id: youseppe.id },
      data: { cartaStatus: "PENDING", errorLog: null },
    });
    console.log("Youseppe reset to PENDING");
  }

  await p.$disconnect();
}
main();
