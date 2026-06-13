import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const slug = "taranta-chicureo";
  const r = await prisma.restaurant.findFirst({ where: { slug }, select: { id: true, name: true } });
  if (!r) { console.log("Not found"); return; }

  // Get all dishes
  const dishes = await prisma.dish.findMany({
    where: { restaurantId: r.id },
    select: { id: true, name: true, photos: true },
  });
  console.log("Dishes in DB:", dishes.length);

  // Get all product URLs from sitemap
  const sitemapRes = await fetch("https://tarantarestaurante.ola.click/sitemap.xml");
  const xml = await sitemapRes.text();
  const productUrls = [...xml.matchAll(/<loc>(https:[^<]+\/[a-z0-9-]+\/[a-z0-9-]+)<\/loc>/g)].map(m => m[1]);
  console.log("Product URLs in sitemap:", productUrls.length);

  // Fetch all product pages in batches and extract photos
  const photoMap = new Map(); // productSlug -> photoUrl
  const BATCH = 15;
  for (let i = 0; i < productUrls.length; i += BATCH) {
    const batch = productUrls.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map(async url => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        const html = await res.text();
        const imgMatch = html.match(/https:\/\/assets\.olaclick\.app\/companies\/products\/images\/800\/[a-f0-9-]+\.\w+/);
        const parts = url.split("/");
        const productSlug = parts[parts.length - 1];
        if (imgMatch) photoMap.set(productSlug, imgMatch[0]);
      } catch {}
    }));
    process.stdout.write(`\r  Fetched ${Math.min(i + BATCH, productUrls.length)}/${productUrls.length} product pages, ${photoMap.size} photos found`);
  }
  console.log();

  // Match photos to dishes by normalizing names to slug-like format
  function slugify(name) {
    return name.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  let matched = 0;
  let noPhoto = 0;
  for (const dish of dishes) {
    const dishSlug = slugify(dish.name);
    // Try exact match, then partial
    let photoUrl = photoMap.get(dishSlug);
    if (!photoUrl) {
      // Try finding a product slug that contains the dish slug or vice versa
      for (const [pSlug, pUrl] of photoMap) {
        if (pSlug.includes(dishSlug) || dishSlug.includes(pSlug)) {
          photoUrl = pUrl;
          break;
        }
      }
    }
    if (photoUrl) {
      await prisma.dish.update({
        where: { id: dish.id },
        data: { photos: [photoUrl] },
      });
      matched++;
    } else {
      noPhoto++;
    }
  }

  console.log("\nMatched and updated:", matched);
  console.log("No photo found:", noPhoto);
  
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
