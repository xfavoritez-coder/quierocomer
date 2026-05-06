import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const r = await prisma.restaurant.findFirst({ where: { slug: "hand-roll" } });
  if (!r) return;
  const dishes = await prisma.dish.findMany({
    where: { restaurantId: r.id, deletedAt: null, isActive: true },
    select: { name: true, photos: true },
  });
  const domains: Record<string, number> = {};
  for (const d of dishes) {
    if (d.photos.length === 0) continue;
    const url = d.photos[0];
    try {
      const host = new URL(url).hostname;
      domains[host] = (domains[host] || 0) + 1;
    } catch {
      domains["INVALID"] = (domains["INVALID"] || 0) + 1;
    }
  }
  console.log("Dominios de fotos en Hand Roll:");
  for (const [host, count] of Object.entries(domains).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${host}: ${count}`);
  }

  // Probar 1 URL de cada dominio
  const sampled: Set<string> = new Set();
  for (const d of dishes) {
    if (d.photos.length === 0) continue;
    const url = d.photos[0];
    let host = "";
    try { host = new URL(url).hostname; } catch { continue; }
    if (sampled.has(host)) continue;
    sampled.add(host);
    try {
      const res = await fetch(url, { method: "HEAD" });
      console.log(`\n${host}: ${res.status} ${res.headers.get("content-type")}`);
      console.log(`  URL: ${url.substring(0, 100)}`);
    } catch (e: any) {
      console.log(`\n${host}: FETCH ERROR ${e.message}`);
    }
  }
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
