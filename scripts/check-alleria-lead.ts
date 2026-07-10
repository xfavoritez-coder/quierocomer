import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  const r = await p.restaurant.findFirst({
    where: { name: { contains: "alleria", mode: "insensitive" } },
    select: { id: true, slug: true, name: true },
  });
  if (!r) { console.log("Restaurante no encontrado"); return; }
  console.log("Restaurante:", r.name, "| slug:", r.slug);

  const lead = await p.lead.findFirst({
    where: { generatedSlug: r.slug },
    select: { id: true, generatedSlug: true, email: true, localName: true },
  });
  console.log("Lead con generatedSlug:", lead ? JSON.stringify(lead) : "NO ENCONTRADO — excluida del dashboard admin");
}

main().catch(console.error).finally(() => p.$disconnect());
