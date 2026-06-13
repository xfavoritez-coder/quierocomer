import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  const r = await p.restaurant.findFirst({
    where: { slug: "alleria-pizza" },
    select: { id: true, name: true },
  });
  if (!r) { console.log("not found"); return; }
  console.log(`Restaurant: ${r.name}`);

  const dishes = await p.dish.findMany({
    where: { restaurantId: r.id, deletedAt: null, isActive: true },
    select: { id: true, name: true, photos: true, isPhotoReferential: true, category: { select: { name: true } } },
    orderBy: [{ category: { position: "asc" } }, { position: "asc" }],
  });

  const withPhotos = dishes.filter(d => d.photos.length > 0);
  const withoutPhotos = dishes.filter(d => d.photos.length === 0);
  const referential = dishes.filter(d => d.isPhotoReferential);

  console.log(`\nTotal platos activos: ${dishes.length}`);
  console.log(`Con foto: ${withPhotos.length}`);
  console.log(`Sin foto: ${withoutPhotos.length}`);
  console.log(`Fotos referenciales (Unsplash): ${referential.length}`);

  // Check photo URLs
  const allUrls = withPhotos.flatMap(d => d.photos);
  console.log(`\nTotal URLs de fotos: ${allUrls.length}`);

  // Categorize by source
  const supabase = allUrls.filter(u => u.includes("supabase"));
  const unsplash = allUrls.filter(u => u.includes("unsplash"));
  const other = allUrls.filter(u => !u.includes("supabase") && !u.includes("unsplash"));

  console.log(`  Supabase: ${supabase.length}`);
  console.log(`  Unsplash: ${unsplash.length}`);
  console.log(`  Otras: ${other.length}`);

  // Check sizes of a sample of photos
  console.log("\n--- Peso de fotos (sample) ---");
  const sample = allUrls.slice(0, 20);
  for (const url of sample) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      const size = res.headers.get("content-length");
      const type = res.headers.get("content-type");
      const sizeKB = size ? (parseInt(size) / 1024).toFixed(0) : "?";
      const shortUrl = url.length > 80 ? url.slice(0, 77) + "..." : url;
      console.log(`  ${sizeKB} KB  ${type}  ${shortUrl}`);
    } catch (e: any) {
      console.log(`  ERROR: ${url.slice(0, 60)}... ${e.message}`);
    }
  }

  // Show all photos with dish names for full picture
  console.log("\n--- Todas las fotos por categoría ---");
  let currentCat = "";
  for (const d of withPhotos) {
    if (d.category.name !== currentCat) {
      currentCat = d.category.name;
      console.log(`\n[${currentCat}]`);
    }
    for (const url of d.photos) {
      try {
        const res = await fetch(url, { method: "HEAD" });
        const size = res.headers.get("content-length");
        const sizeKB = size ? (parseInt(size) / 1024).toFixed(0) : "?";
        console.log(`  ${d.name}: ${sizeKB} KB`);
      } catch {
        console.log(`  ${d.name}: ? KB`);
      }
    }
  }

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
