import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const p = new PrismaClient();
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

const MAX_KB = 120;
const MAX_WIDTH = 1200;

async function recompressRestaurant(slug: string) {
  const r = await p.restaurant.findFirst({ where: { slug }, select: { id: true, name: true } });
  if (!r) { console.log(`❌ ${slug} not found`); return; }
  console.log(`\n══════ ${r.name} ══════`);

  const dishes = await p.dish.findMany({
    where: { restaurantId: r.id, deletedAt: null, isActive: true },
    select: { id: true, name: true, photos: true },
  });

  let processed = 0;
  for (const d of dishes) {
    for (const url of d.photos) {
      try {
        const headRes = await fetch(url, { method: "HEAD" });
        const size = parseInt(headRes.headers.get("content-length") || "0");
        if (size <= MAX_KB * 1024) continue;

        const sizeKB = Math.round(size / 1024);
        console.log(`  ${d.name}: ${sizeKB} KB`);

        const res = await fetch(url);
        const buf = Buffer.from(await res.arrayBuffer());
        const meta = await sharp(buf).metadata();
        let width = Math.min(meta.width || MAX_WIDTH, MAX_WIDTH);

        let output = await sharp(buf).resize(width).webp({ quality: 75 }).toBuffer();
        if (output.length > MAX_KB * 1024) {
          output = await sharp(buf).resize(width).webp({ quality: 60 }).toBuffer();
        }
        if (output.length > MAX_KB * 1024) {
          width = 900;
          output = await sharp(buf).resize(width).webp({ quality: 60 }).toBuffer();
        }

        const pathMatch = url.match(/\/fotos\/(.+)$/);
        if (!pathMatch) { console.log(`    SKIP: can't parse path`); continue; }

        const { error } = await supabase.storage.from("fotos").update(pathMatch[1], output, {
          contentType: "image/webp", upsert: true,
        });

        if (error) console.log(`    ERROR: ${error.message}`);
        else { console.log(`    ${sizeKB} KB → ${Math.round(output.length / 1024)} KB ✓`); processed++; }
      } catch (e: any) {
        console.log(`    ERROR: ${e.message}`);
      }
    }
  }
  console.log(`  Total procesadas: ${processed}`);
}

async function main() {
  await recompressRestaurant("horusvegan");
  await recompressRestaurant("hand-roll");
  await recompressRestaurant("el-menu-de-la-esquina");
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
