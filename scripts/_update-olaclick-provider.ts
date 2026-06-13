import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const provider = await prisma.menuProvider.findFirst({
    where: { name: { contains: "laClick", mode: "insensitive" } },
  });
  if (!provider) { console.log("OlaClick provider not found"); return; }
  console.log("Current provider:", JSON.stringify(provider, null, 2));

  const updated = await prisma.menuProvider.update({
    where: { id: provider.id },
    data: {
      extractionConfig: {
        useJina: true,
        waitForSelector: ".infinite-products",
        useSitemap: true,
        sitemapPath: "/sitemap.xml",
        categoryDiscovery: "sitemap+jina",
        photoExtraction: "individual-product-pages",
        photoPattern: "https://assets.olaclick.app/companies/products/images/800/{uuid}.{ext}",
        batchSize: 15,
        jinaTimeout: 20000,
      },
      notes: `Vue.js/Nuxt SPA con lazy loading por categoría. El extractor:
(1) Fetch /products con Jina para primera categoría visible
(2) Fetch /sitemap.xml directo (sin Jina) para descubrir TODOS los slugs de categoría reales — esto es crítico porque los slugs son específicos de cada restaurante (ej: "platos-del-cheff", "fugazzas", "pizza-a-la-piedra-individual") y NO coinciden con slugs genéricos
(3) Probe cada slug de categoría via Jina en batches de 8 para obtener el contenido renderizado
(4) Combina todo y extrae con Claude
(5) FOTOS: No vienen en las páginas de categoría. Se extraen de las páginas individuales de cada producto (/categoria/producto) haciendo fetch directo (sin Jina). El patrón es: https://assets.olaclick.app/companies/products/images/800/{uuid}.jpeg

IMPORTANTE: Sin el sitemap, solo se capturan 1-2 categorías de ~22. Corregido junio 2026.
IMPORTANTE: Las fotos requieren fetch individual por producto desde el sitemap. Sin esto, la carta queda sin fotos.`,
    },
  });

  console.log("\nUpdated provider notes and config successfully");
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
