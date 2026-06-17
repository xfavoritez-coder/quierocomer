/**
 * Reimport BADA photos from Queresto using original (non-resized) Bistrify CDN URLs.
 * The previous import used w=128 thumbnails due to a filter bug in the extractor.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const prisma = new PrismaClient();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

async function optimizeImage(buffer: Buffer): Promise<Buffer> {
  const MAX_DIM = 1200;
  const QUALITY = 85;
  let img = sharp(buffer).rotate();
  const meta = await img.metadata();
  if ((meta.width && meta.width > MAX_DIM) || (meta.height && meta.height > MAX_DIM)) {
    img = img.resize(MAX_DIM, MAX_DIM, { fit: "inside", withoutEnlargement: true });
  }
  return img.webp({ quality: QUALITY, effort: 4, smartSubsample: true }).toBuffer();
}

async function fetchImage(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; QuieroComer/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 500 ? buf : null;
  } catch {
    return null;
  }
}

async function main() {
  // 1. Fetch BADA page and extract unique original image URLs
  console.log("Fetching queresto.com/bada...");
  const res = await fetch("https://queresto.com/bada", {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; QuieroComer/1.0)" },
    signal: AbortSignal.timeout(10000),
  });
  const html = await res.text();

  // Extract all w=128 dish thumbnail URLs, deduplicated
  const thumbMatches = [...html.matchAll(/https:\/\/cdn\.bistrify\.app\/cdn-cgi\/image\/w=128[^\s"']*/gi)];
  const seen = new Set<string>();
  const imgUrls: string[] = [];
  for (const m of thumbMatches) {
    const thumbUrl = m[0].split(" ")[0];
    const pathMatch = thumbUrl.match(/\/images\/(.+)$/);
    if (!pathMatch) continue;
    const url = `https://cdn.bistrify.app/images/${pathMatch[1]}`;
    if (!seen.has(url)) { seen.add(url); imgUrls.push(url); }
  }

  console.log(`Found ${imgUrls.length} unique original image URLs:`);
  imgUrls.forEach((u, i) => console.log(`  ${i + 1}. ${u}`));

  // 2. Get BADA dishes from DB ordered by position
  const restaurant = await prisma.restaurant.findFirst({
    where: { slug: "restaurant-bada" },
    select: { id: true, name: true },
  });
  if (!restaurant) throw new Error("Restaurant BADA not found");
  console.log(`\nRestaurant: ${restaurant.name} (${restaurant.id})`);

  const dishes = await prisma.dish.findMany({
    where: { restaurantId: restaurant.id, isActive: true, deletedAt: null },
    select: { id: true, name: true, photos: true },
    orderBy: { position: "asc" },
  });
  console.log(`DB dishes: ${dishes.length}`);
  dishes.forEach((d, i) => console.log(`  ${i + 1}. ${d.name}`));

  // 3. Re-upload each photo at original quality and update DB
  const pairCount = Math.min(dishes.length, imgUrls.length);
  console.log(`\nReimporting ${pairCount} photos...`);

  for (let i = 0; i < pairCount; i++) {
    const dish = dishes[i];
    const imgUrl = imgUrls[i];
    process.stdout.write(`  [${i + 1}/${pairCount}] ${dish.name} — fetching...`);

    const rawBuf = await fetchImage(imgUrl);
    if (!rawBuf) {
      console.log(" SKIP (fetch failed)");
      continue;
    }

    const optimized = await optimizeImage(rawBuf);
    const meta = await sharp(rawBuf).metadata();
    const fileName = `dishes/${restaurant.id}-reimport-${Date.now()}-${i}.webp`;

    const { error } = await supabase.storage
      .from("fotos")
      .upload(fileName, optimized, { contentType: "image/webp", upsert: true });

    if (error) {
      console.log(` SKIP (upload error: ${error.message})`);
      continue;
    }

    const { data } = supabase.storage.from("fotos").getPublicUrl(fileName);
    await prisma.dish.update({
      where: { id: dish.id },
      data: { photos: [data.publicUrl] },
    });

    console.log(` OK (${meta.width}x${meta.height} → WebP)`);
    await new Promise((r) => setTimeout(r, 200)); // small delay to avoid hammering CDN
  }

  console.log("\nDone!");
  await prisma.$disconnect();
}

main().catch(console.error);
