/**
 * Script para migrar fotos externas a Supabase Storage.
 *
 * Uso:
 *   1. Crear bucket "fotos" en Supabase Dashboard (Storage → New bucket → público)
 *   2. Agregar SUPABASE_SERVICE_KEY en .env.local
 *   3. Correr: node scripts/migrate-photos.js
 *
 * Migra: fotos de platos (Dish.photos[]) + logos/banners de Restaurant
 */

require("dotenv").config({ path: ".env.local" });
const { PrismaClient } = require("@prisma/client");
const { createClient } = require("@supabase/supabase-js");

const BUCKET = "fotos";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
const prisma = new PrismaClient();

let migrated = 0;
let skipped = 0;
let failed = 0;

async function downloadImage(url) {
  const res = await fetch(url, { headers: { "User-Agent": "QuieroComer/1.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") || "image/jpeg";
  return { buffer, contentType };
}

function getExtension(url, contentType) {
  if (contentType?.includes("png")) return ".png";
  if (contentType?.includes("webp")) return ".webp";
  // Try from URL
  const match = url.match(/\.(jpg|jpeg|png|webp|gif)/i);
  if (match) return "." + match[1].toLowerCase();
  return ".jpg";
}

async function uploadToSupabase(buffer, path, contentType) {
  const { data, error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType,
    upsert: true,
  });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return urlData.publicUrl;
}

function isExternal(url) {
  if (!url) return false;
  if (url.includes("supabase")) return false; // Already migrated
  return url.startsWith("http");
}

async function migrateDishPhotos() {
  console.log("\n📸 Migrando fotos de platos...\n");
  const dishes = await prisma.dish.findMany({
    where: { NOT: { photos: { equals: [] } } },
    select: { id: true, name: true, photos: true, restaurant: { select: { slug: true } } },
  });

  for (const dish of dishes) {
    const newPhotos = [];
    let changed = false;

    for (let i = 0; i < dish.photos.length; i++) {
      const url = dish.photos[i];
      if (!isExternal(url)) {
        newPhotos.push(url);
        continue;
      }

      try {
        const { buffer, contentType } = await downloadImage(url);
        const ext = getExtension(url, contentType);
        const path = `dishes/${dish.restaurant.slug}/${dish.id}_${i}${ext}`;
        const newUrl = await uploadToSupabase(buffer, path, contentType);
        newPhotos.push(newUrl);
        changed = true;
        migrated++;
        console.log(`  ✅ ${dish.restaurant.slug}/${dish.name} [${i}]`);
      } catch (e) {
        console.log(`  ❌ ${dish.restaurant.slug}/${dish.name} [${i}]: ${e.message}`);
        newPhotos.push(url); // Keep original on failure
        failed++;
      }
    }

    if (changed) {
      await prisma.dish.update({ where: { id: dish.id }, data: { photos: newPhotos } });
    }
  }
}

async function migrateRestaurantImages() {
  console.log("\n🏠 Migrando logos y banners de restaurantes...\n");
  const restaurants = await prisma.restaurant.findMany({
    select: { id: true, slug: true, name: true, logoUrl: true, bannerUrl: true },
  });

  for (const r of restaurants) {
    // Logo
    if (isExternal(r.logoUrl)) {
      try {
        const { buffer, contentType } = await downloadImage(r.logoUrl);
        const ext = getExtension(r.logoUrl, contentType);
        const path = `restaurants/${r.slug}/logo${ext}`;
        const newUrl = await uploadToSupabase(buffer, path, contentType);
        await prisma.restaurant.update({ where: { id: r.id }, data: { logoUrl: newUrl } });
        migrated++;
        console.log(`  ✅ ${r.slug} logo`);
      } catch (e) {
        console.log(`  ❌ ${r.slug} logo: ${e.message}`);
        failed++;
      }
    }

    // Banner
    if (isExternal(r.bannerUrl)) {
      try {
        const { buffer, contentType } = await downloadImage(r.bannerUrl);
        const ext = getExtension(r.bannerUrl, contentType);
        const path = `restaurants/${r.slug}/banner${ext}`;
        const newUrl = await uploadToSupabase(buffer, path, contentType);
        await prisma.restaurant.update({ where: { id: r.id }, data: { bannerUrl: newUrl } });
        migrated++;
        console.log(`  ✅ ${r.slug} banner`);
      } catch (e) {
        console.log(`  ❌ ${r.slug} banner: ${e.message}`);
        failed++;
      }
    }
  }
}

async function main() {
  console.log("🚀 Migrando fotos a Supabase Storage...");
  console.log(`   Bucket: ${BUCKET}`);
  console.log(`   Supabase: ${process.env.NEXT_PUBLIC_SUPABASE_URL}\n`);

  // Check bucket exists
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.find(b => b.name === BUCKET)) {
    console.log(`⚠️  Bucket "${BUCKET}" no existe. Creándolo...`);
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (error) {
      console.error(`❌ No se pudo crear el bucket: ${error.message}`);
      console.log("   Créalo manualmente en Supabase Dashboard → Storage → New bucket (público)");
      console.log("   Y agrega SUPABASE_SERVICE_KEY en .env.local");
      process.exit(1);
    }
    console.log(`✅ Bucket "${BUCKET}" creado.\n`);
  }

  await migrateDishPhotos();
  await migrateRestaurantImages();

  console.log(`\n📊 Resultado:`);
  console.log(`   ✅ Migradas: ${migrated}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Fallidas: ${failed}`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
