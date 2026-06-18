import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { slugify } from "../src/lib/slugify";

const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

function upgradeGoogleLh3(url: string): string {
  if (!url.includes("lh3.googleusercontent.com")) return url;
  if (/=s\d+$/.test(url)) return url.replace(/=s\d+$/, "=s1200");
  return url.replace(/(\?.*)?$/, "=s1200");
}
async function optimizeImage(buf: Buffer): Promise<Buffer> {
  let img = sharp(buf).rotate();
  const meta = await img.metadata();
  if ((meta.width && meta.width > 1200) || (meta.height && meta.height > 1200))
    img = img.resize(1200, 1200, { fit: "inside", withoutEnlargement: true });
  return img.webp({ quality: 85, effort: 4, smartSubsample: true }).toBuffer();
}
async function fetchBuf(url: string): Promise<Buffer | null> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return buf.length > 500 ? buf : null;
  } catch { return null; }
}

async function main() {
  const rest = await prisma.restaurant.findFirst({ where: { slug: "sushinikkei17" }, select: { id: true, name: true } });
  if (!rest) throw new Error("Not found");

  // Jina render to get fresh image URLs
  console.log("Fetching Jina render...");
  const jinaRes = await fetch("https://r.jina.ai/https://toteat.app/r/cl/Sushinikkei17/4932/checkin/menu", {
    headers: { "Accept": "text/plain", "X-No-Cache": "true", "X-Timeout": "45000" },
    signal: AbortSignal.timeout(55000),
  });
  const content = await jinaRes.text();
  
  // Extract all image URLs with their preceding dish name context
  interface DishImg { name: string; imageUrl: string }
  const imgs: DishImg[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("![") && line.includes("lh3.googleusercontent.com")) {
      const m = line.match(/\(([^)]+)\)/);
      // Look backwards for dish name
      const nameLine = lines.slice(Math.max(0, i-3), i).reverse().find(l => l.trim().length > 3 && !l.startsWith("!") && !l.startsWith("$") && !/^\d/.test(l.trim()));
      if (m && nameLine) imgs.push({ name: nameLine.trim(), imageUrl: m[1] });
    }
  }
  console.log(`Found ${imgs.length} images in Jina\n`);

  const dbDishes = await prisma.dish.findMany({
    where: { restaurantId: rest.id, isActive: true, deletedAt: null },
    select: { id: true, name: true },
  });

  let updated = 0;
  for (const ext of imgs) {
    const extSlug = slugify(ext.name);
    const db = dbDishes.find((d) => slugify(d.name) === extSlug);
    if (!db) { console.log(`  SKIP (no match): "${ext.name}"`); continue; }
    const hdUrl = upgradeGoogleLh3(ext.imageUrl);
    process.stdout.write(`  [${ext.name}] `);
    const buf = await fetchBuf(hdUrl);
    if (!buf) { console.log("SKIP (fetch)"); continue; }
    const meta = await sharp(buf).metadata();
    const optimized = await optimizeImage(buf);
    const fileName = `dishes/${rest.id}-sn17-${Date.now()}-${slugify(ext.name).slice(0, 20)}.webp`;
    const { error } = await supabase.storage.from("fotos").upload(fileName, optimized, { contentType: "image/webp", upsert: true });
    if (error) { console.log(`SKIP (${error.message})`); continue; }
    const { data } = supabase.storage.from("fotos").getPublicUrl(fileName);
    await prisma.dish.update({ where: { id: db.id }, data: { photos: [data.publicUrl] } });
    console.log(`OK (${meta.width}x${meta.height})`);
    updated++;
    await new Promise((r) => setTimeout(r, 200));
  }
  console.log(`\nDone! Updated ${updated} photos.`);
  await prisma.$disconnect();
}
main().catch(console.error);
