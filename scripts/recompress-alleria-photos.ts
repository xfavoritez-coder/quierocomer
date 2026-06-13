import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const p = new PrismaClient();
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

const MAX_KB = 120;
const MAX_WIDTH = 1200;

async function main() {
  const r = await p.restaurant.findFirst({ where: { slug: "alleria-pizza" }, select: { id: true, name: true } });
  if (!r) { console.log("not found"); return; }

  const dishes = await p.dish.findMany({
    where: { restaurantId: r.id, deletedAt: null, isActive: true },
    select: { id: true, name: true, photos: true },
  });

  const heavy = [];
  for (const d of dishes) {
    for (const url of d.photos) {
      try {
        const res = await fetch(url, { method: "HEAD" });
        const size = parseInt(res.headers.get("content-length") || "0");
        if (size > MAX_KB * 1024) {
          heavy.push({ dish: d, url, sizeKB: Math.round(size / 1024) });
        }
      } catch {}
    }
  }

  console.log(`Found ${heavy.length} photos over ${MAX_KB}KB\n`);

  for (const item of heavy) {
    console.log(`Processing: ${item.dish.name} (${item.sizeKB} KB)`);

    // Download
    const res = await fetch(item.url);
    const buf = Buffer.from(await res.arrayBuffer());

    // Get metadata
    const meta = await sharp(buf).metadata();
    console.log(`  Original: ${meta.width}x${meta.height}`);

    // Compress - pass 1: resize + quality 75
    let width = Math.min(meta.width || MAX_WIDTH, MAX_WIDTH);
    let output = await sharp(buf).resize(width).webp({ quality: 75 }).toBuffer();
    console.log(`  Pass 1 (q75, w${width}): ${Math.round(output.length / 1024)} KB`);

    // Pass 2 if still too big
    if (output.length > MAX_KB * 1024) {
      output = await sharp(buf).resize(width).webp({ quality: 60 }).toBuffer();
      console.log(`  Pass 2 (q60, w${width}): ${Math.round(output.length / 1024)} KB`);
    }

    // Pass 3 if still too big - reduce resolution
    if (output.length > MAX_KB * 1024) {
      width = 900;
      output = await sharp(buf).resize(width).webp({ quality: 60 }).toBuffer();
      console.log(`  Pass 3 (q60, w${width}): ${Math.round(output.length / 1024)} KB`);
    }

    // Extract storage path from URL
    const pathMatch = item.url.match(/\/fotos\/(.+)$/);
    if (!pathMatch) { console.log(`  SKIP: can't parse path`); continue; }
    const storagePath = pathMatch[1];

    // Upload replacement
    const { error } = await supabase.storage.from("fotos").update(storagePath, output, {
      contentType: "image/webp",
      upsert: true,
    });

    if (error) {
      console.log(`  ERROR uploading: ${error.message}`);
    } else {
      console.log(`  OK: ${item.sizeKB} KB → ${Math.round(output.length / 1024)} KB ✓\n`);
    }
  }

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
