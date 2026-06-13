import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const updated = await prisma.menuProvider.updateMany({
    where: { name: "OlaClick" },
    data: {
      status: "SUPPORTED",
      notes: "Vue.js/Nuxt SPA con lazy loading por categoría. El extractor ahora: (1) Fetch /products para primera categoría, (2) Probe ~50 slugs comunes de categoría en paralelo via Jina, (3) Combina todas las páginas con precios y extrae con Claude. Resuelto junio 2026: antes solo capturaba la primera categoría visible.",
    },
  });
  console.log("Updated:", updated.count, "providers");
}
main().catch(console.error).finally(() => prisma.$disconnect());
