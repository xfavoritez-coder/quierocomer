/**
 * Reimport MEI HUA photos from Queresto using the fixed extractor
 * (which now strips cdn.bistrify.app CDN transforms to get original HD images).
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { extractQueresto } from "../src/lib/extractors/queresto";
import { slugify } from "../src/lib/slugify";

const prisma = new PrismaClient();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

async function optimizeImage(buffer: Buffer): Promise<Buffer> {
  let img = sharp(buffer).rotate();
  const meta = await img.metadata();
  if ((meta.width && meta.width > 1200) || (meta.height && meta.height > 1200)) {
    img = img.resize(1200, 1200, { fit: "inside", withoutEnlargement: true });
  }
  return img.webp({ quality: 85, effort: 4, smartSubsample: true }).toBuffer();
}

async function fetchImage(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; QuieroComer/1.0)" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 500 ? buf : null;
  } catch {
    return null;
  }
}

async function main() {
  console.log("Extracting MEI HUA from Queresto...");
  const extraction = await extractQueresto("https://queresto.com/meihuasandiego");
  const extracted = extraction.dishes.filter(d => d.imageUrl);
  console.log(`Extracted ${extraction.dishes.length} dishes, ${extracted.length} with photos`);

  const restaurant = await prisma.restaurant.findFirst({
    where: { slug: "mei-hua" },
    select: { id: true, name: true },
  });
  if (!restaurant) throw new Error("Restaurant Mei Hua not found");
  console.log(`Restaurant: ${restaurant.name} (${restaurant.id})`);

  const dbDishes = await prisma.dish.findMany({
    where: { restaurantId: restaurant.id, isActive: true, deletedAt: null },
    select: { id: true, name: true, photos: true },
  });

  // Match extracted dishes to DB dishes by slugified name
  let updated = 0;
  for (const ext of extracted) {
    const extSlug = slugify(ext.name);
    const db = dbDishes.find(d => slugify(d.name) === extSlug);
    if (!db) {
      console.log(`  SKIP (no DB match): ${ext.name}`);
      continue;
    }

    process.stdout.write(`  [${ext.name}] fetching ${ext.imageUrl}...`);
    const rawBuf = await fetchImage(ext.imageUrl!);
    if (!rawBuf) {
      console.log(" SKIP (fetch failed)");
      continue;
    }

    const meta = await sharp(rawBuf).metadata();
    const optimized = await optimizeImage(rawBuf);
    const fileName = `dishes/${restaurant.id}-reimport-${Date.now()}-${slugify(ext.name)}.webp`;

    const { error } = await supabase.storage
      .from("fotos")
      .upload(fileName, optimized, { contentType: "image/webp", upsert: true });

    if (error) {
      console.log(` SKIP (upload error: ${error.message})`);
      continue;
    }

    const { data } = supabase.storage.from("fotos").getPublicUrl(fileName);
    await prisma.dish.update({
      where: { id: db.id },
      data: { photos: [data.publicUrl] },
    });

    console.log(` OK (${meta.width}x${meta.height} → WebP)`);
    updated++;
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\nDone! Updated ${updated} photos.`);
  await prisma.$disconnect();
}

main().catch(console.error);
