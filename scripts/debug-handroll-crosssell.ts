import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const r = await prisma.restaurant.findFirst({ where: { slug: "hand-roll" } });
  if (!r) { console.log("Hand Roll no encontrado"); return; }
  console.log(`Restaurant: ${r.name}`);

  // Ver TODAS las fotos: si son strings vacíos, urls válidas, etc
  const dishes = await prisma.dish.findMany({
    where: { restaurantId: r.id, deletedAt: null, isActive: true },
    select: { id: true, name: true, photos: true },
    orderBy: { name: "asc" },
  });

  console.log(`\nTotal platos: ${dishes.length}\n`);

  // Categorizar tipos de fotos
  let emptyArr = 0;
  let firstEmpty = 0;
  let validUrl = 0;
  let badUrl = 0;
  for (const d of dishes) {
    if (d.photos.length === 0) { emptyArr++; continue; }
    const first = d.photos[0];
    if (!first || first.trim() === "") { firstEmpty++; console.log(`  ⚠️  ${d.name}: photos[0] vacío "${first}"`); continue; }
    if (first.startsWith("http")) { validUrl++; }
    else { badUrl++; console.log(`  ⚠️  ${d.name}: URL no http "${first.substring(0, 60)}"`); }
  }
  console.log(`\nphotos vacío []: ${emptyArr}`);
  console.log(`photos[0] string vacío: ${firstEmpty}`);
  console.log(`URL válida (http): ${validUrl}`);
  console.log(`URL no http: ${badUrl}`);

  // Test 1 URL para ver si responde
  const sampleD = dishes.find(d => d.photos.length > 0 && d.photos[0]?.startsWith("http"));
  if (sampleD) {
    console.log(`\nProbando URL ejemplo: ${sampleD.name}`);
    console.log(`URL: ${sampleD.photos[0]}`);
    try {
      const res = await fetch(sampleD.photos[0], { method: "HEAD" });
      console.log(`Status: ${res.status} ${res.headers.get("content-type")}`);
    } catch (e: any) {
      console.log(`ERROR fetch: ${e.message}`);
    }
  }

  // Manual suggestions configuradas en Hand Roll?
  const sugs = await prisma.dishSuggestion.findMany({
    where: { fromDish: { restaurantId: r.id } },
    take: 5,
    include: { fromDish: { select: { name: true } }, toDish: { select: { name: true, photos: true } } },
  });
  console.log(`\nManual suggestions configuradas: ${sugs.length}`);
  for (const s of sugs.slice(0, 5)) {
    console.log(`  ${s.fromDish.name} → ${s.toDish.name} (toDish photos: ${s.toDish.photos.length})`);
  }
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
