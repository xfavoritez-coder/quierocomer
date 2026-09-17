/**
 * Reimport photos for La Mía Pizza Rengo from InfluyeApp API.
 * Usage: node scripts/reimport-influyeapp-photos.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";

// Load env
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => { const [k, ...v] = l.split("="); return [k.trim(), v.join("=").trim().replace(/^"|"$/g, "")]; })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const prisma = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL || env.DATABASE_URL } } });

const STORE_URL = "https://lamiapizzarengo.cl";
const RESTAURANT_SLUG = "la-mia-pizza-rengo";
const IMAGE_BASE = "https://static.influye.app/storage/products";
const CONCURRENT = 8;

function slugify(name) {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function downloadImage(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://backend.influye.app/" },
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);
  if (!res || !res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 500) return null;
  return buf;
}

async function uploadToSupabase(buffer, restaurantId, dishSlug) {
  // Convert to webp-like upload (we'll use the buffer as-is since we don't have sharp here)
  const fileName = `dishes/${restaurantId}-${Date.now()}-${dishSlug.slice(0, 30)}.png`;
  const { error } = await supabase.storage.from("fotos").upload(fileName, buffer, { contentType: "image/png", upsert: true });
  if (error) { console.error("  Upload error:", error.message); return null; }
  const { data } = supabase.storage.from("fotos").getPublicUrl(fileName);
  return data.publicUrl;
}

async function main() {
  console.log("Fetching InfluyeApp menu for", STORE_URL);
  const origin = new URL(STORE_URL).origin;
  const res = await fetch("https://backend.influye.app/store/totem/menu", {
    headers: { Accept: "application/json", Origin: origin, Referer: STORE_URL + "/", "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) { console.error("API error:", res.status); process.exit(1); }
  const data = await res.json();

  // Build name→imageFilename map (normalize names for matching)
  const imageMap = new Map(); // normalized name → image filename
  for (const section of data.menu || []) {
    for (const item of section.items || []) {
      if (!item.title || !item.image) continue;
      const key = item.title.toLowerCase().trim().replace(/\s+/g, " ");
      imageMap.set(key, item.image);
    }
  }
  console.log(`API: ${imageMap.size} items with images`);

  // Get restaurant
  const restaurant = await prisma.restaurant.findFirst({ where: { slug: RESTAURANT_SLUG }, select: { id: true, name: true } });
  if (!restaurant) { console.error("Restaurant not found"); process.exit(1); }
  console.log("Restaurant:", restaurant.name, "| id:", restaurant.id);

  // Get all dishes without photos
  const dishes = await prisma.dish.findMany({
    where: { restaurantId: restaurant.id, photos: { isEmpty: true } },
    select: { id: true, name: true },
  });
  console.log(`Dishes without photos: ${dishes.length}`);

  // Match dishes to image URLs
  const toProcess = [];
  let noMatch = 0;
  for (const dish of dishes) {
    const key = dish.name.toLowerCase().trim().replace(/\s+/g, " ");
    const imageFile = imageMap.get(key);
    if (!imageFile) { noMatch++; continue; }
    toProcess.push({ id: dish.id, name: dish.name, imageUrl: `${IMAGE_BASE}/${imageFile}` });
  }
  console.log(`Matched: ${toProcess.length} | No match: ${noMatch}`);

  // Process in batches
  let ok = 0, fail = 0;
  for (let i = 0; i < toProcess.length; i += CONCURRENT) {
    const batch = toProcess.slice(i, i + CONCURRENT);
    await Promise.all(batch.map(async (dish) => {
      const buf = await downloadImage(dish.imageUrl);
      if (!buf) { console.log(`  SKIP (download failed): ${dish.name}`); fail++; return; }
      const publicUrl = await uploadToSupabase(buf, restaurant.id, slugify(dish.name));
      if (!publicUrl) { fail++; return; }
      await prisma.dish.update({ where: { id: dish.id }, data: { photos: [publicUrl] } });
      ok++;
      if (ok % 10 === 0) console.log(`  Progress: ${ok}/${toProcess.length}`);
    }));
  }

  console.log(`\nDone! Updated: ${ok} | Failed: ${fail} | No match: ${noMatch}`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
