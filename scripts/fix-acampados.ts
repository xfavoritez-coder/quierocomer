import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import fs from "fs";

const prisma = new PrismaClient();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

function slugify(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function reuploadPhoto(externalUrl: string, restaurantId: string, dishSlug: string): Promise<string | null> {
  try {
    const res = await fetch(externalUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; QuieroComer/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 500) return null;
    let pipeline = sharp(buffer);
    const meta = await pipeline.metadata();
    if (!meta.format) return null;
    if ((meta.width && meta.width > 1200) || (meta.height && meta.height > 1200)) {
      pipeline = pipeline.resize(1200, 1200, { fit: "inside", withoutEnlargement: true });
    }
    const webpBuffer = await pipeline.webp({ quality: 88 }).toBuffer();
    const path = `${restaurantId}/${dishSlug}-${Date.now()}.webp`;
    const { error } = await supabase.storage.from("fotos").upload(path, webpBuffer, { contentType: "image/webp", upsert: true });
    if (error) { console.error(`  Upload error: ${error.message}`); return null; }
    const { data } = supabase.storage.from("fotos").getPublicUrl(path);
    return data.publicUrl;
  } catch (e: any) {
    console.error(`  reupload error: ${e.message}`);
    return null;
  }
}

function normalizeForMatch(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();
}

async function main() {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: "acampados-de-roble" },
    select: { id: true, name: true },
  });
  if (!restaurant) { console.error("Not found!"); return; }

  // Parse the embedded data
  const rawData = fs.readFileSync("scripts/acampados_data.json", "utf8");
  const data = JSON.parse(rawData);
  const menu = data.data?.menu || [];

  const IMAGE_BASE = "https://backend.influye.app/storage/products/";
  const NO_IMAGE = "NO_IMAGE.png";

  // Get all existing dishes
  const existingDishes = await prisma.dish.findMany({
    where: { restaurantId: restaurant.id },
    select: { id: true, name: true, photos: true, category: { select: { name: true } } },
  });

  console.log(`${restaurant.name}: ${existingDishes.length} existing dishes`);
  console.log(`Source menu: ${menu.length} categories\n`);

  let restored = 0;
  let missing = 0;

  for (const cat of menu) {
    const items = cat.items || [];
    for (const item of items) {
      if (!item.image || item.image === NO_IMAGE) continue;

      const photoUrl = IMAGE_BASE + item.image;
      const normalizedItem = normalizeForMatch(item.title);

      // Find matching existing dish
      const match = existingDishes.find(d => normalizeForMatch(d.name) === normalizedItem);

      if (match) {
        if (match.photos.length > 0) continue; // Already has photo

        const dishSlug = slugify(match.name);
        const supabaseUrl = await reuploadPhoto(photoUrl, restaurant.id, dishSlug);
        const finalUrl = supabaseUrl || photoUrl;

        await prisma.dish.update({
          where: { id: match.id },
          data: { photos: [finalUrl], isPhotoReferential: false, photoCredits: [] },
        });
        console.log(`✓ ${match.name}: photo restored from ${item.image}`);
        restored++;
      } else {
        // Try fuzzy match
        const fuzzy = existingDishes.find(d =>
          normalizeForMatch(d.name).includes(normalizedItem) ||
          normalizedItem.includes(normalizeForMatch(d.name))
        );
        if (fuzzy && fuzzy.photos.length === 0) {
          const dishSlug = slugify(fuzzy.name);
          const supabaseUrl = await reuploadPhoto(photoUrl, restaurant.id, dishSlug);
          const finalUrl = supabaseUrl || photoUrl;
          await prisma.dish.update({
            where: { id: fuzzy.id },
            data: { photos: [finalUrl], isPhotoReferential: false, photoCredits: [] },
          });
          console.log(`✓ ${fuzzy.name} (fuzzy): photo from ${item.image}`);
          restored++;
        } else {
          missing++;
        }
      }
    }
  }

  console.log(`\nRestored ${restored} photos, ${missing} unmatched items with photos`);

  // Now fix RECOMMENDED: assign to first dishes WITH photos in first 2 categories
  console.log("\nFixing RECOMMENDED tags...");
  const allDishes = await prisma.dish.findMany({
    where: { restaurantId: restaurant.id, isActive: true },
    orderBy: [{ category: { position: "asc" } }, { position: "asc" }],
    select: { id: true, name: true, photos: true, tags: true, category: { select: { name: true, position: true, dishType: true } } },
  });

  // Clear existing
  for (const d of allDishes) {
    if ((d.tags as string[])?.includes("RECOMMENDED")) {
      await prisma.dish.update({ where: { id: d.id }, data: { tags: (d.tags as string[]).filter(t => t !== "RECOMMENDED") } });
      console.log(`  Removed RECOMMENDED from: ${d.name}`);
    }
  }

  // Assign to first dish with photo in first 2 non-drink categories
  const seenCats = new Set<number>();
  let assigned = 0;
  for (const d of allDishes) {
    if (assigned >= 2) break;
    const catPos = d.category?.position ?? 99;
    if (seenCats.has(catPos)) continue;
    if (d.category?.dishType === "drink") { seenCats.add(catPos); continue; }
    if (d.photos.length > 0) {
      await prisma.dish.update({ where: { id: d.id }, data: { tags: [...(d.tags as string[]).filter(t => t !== "RECOMMENDED"), "RECOMMENDED"] } });
      console.log(`  ⭐ RECOMMENDED: ${d.name} [${d.category?.name}]`);
      seenCats.add(catPos);
      assigned++;
    }
  }

  // Final stats
  const finalPhotos = await prisma.dish.count({ where: { restaurantId: restaurant.id, photos: { isEmpty: false } } });
  const totalDishes = await prisma.dish.count({ where: { restaurantId: restaurant.id } });
  console.log(`\n✓ Done! ${totalDishes} dishes, ${finalPhotos} with photos`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
