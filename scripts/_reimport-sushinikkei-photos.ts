/**
 * Reimport sushinikkei17 photos via Google Places API (new) — lh3 URLs expire,
 * need to fetch fresh photos using the restaurant's placeId.
 */
import { config } from 'dotenv'; config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const API_KEY = process.env.GOOGLE_PLACES_API_KEY!;

async function optimizeImage(buf: Buffer): Promise<Buffer> {
  let img = sharp(buf).rotate();
  const meta = await img.metadata();
  if ((meta.width && meta.width > 1200) || (meta.height && meta.height > 1200))
    img = img.resize(1200, 1200, { fit: 'inside', withoutEnlargement: true });
  return img.webp({ quality: 85, effort: 4, smartSubsample: true }).toBuffer();
}

async function fetchBuf(url: string): Promise<Buffer | null> {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) { console.log(`fetch failed: ${r.status} ${url.substring(0, 60)}`); return null; }
    const buf = Buffer.from(await r.arrayBuffer());
    return buf.length > 500 ? buf : null;
  } catch (e) { console.log(`fetch error: ${(e as Error).message}`); return null; }
}

async function main() {
  const rest = await prisma.restaurant.findFirst({
    where: { slug: 'sushinikkei17' },
    select: { id: true, name: true, googlePlaceId: true }
  });
  if (!rest) throw new Error('Restaurant not found');
  if (!rest.googlePlaceId) throw new Error('No googlePlaceId');
  console.log(`Restaurant: ${rest.name} (${rest.id}), placeId: ${rest.googlePlaceId}\n`);

  // Get all photo names from Places API
  const detailsRes = await fetch(
    `https://places.googleapis.com/v1/places/${rest.googlePlaceId}`,
    { headers: { 'X-Goog-Api-Key': API_KEY, 'X-Goog-FieldMask': 'photos' } }
  );
  const details = await detailsRes.json() as any;
  const photoNames: string[] = (details.photos ?? []).map((p: any) => p.name);
  console.log(`Found ${photoNames.length} Google Place photos\n`);

  // Get dishes with expired lh3 photos
  const dishes = await prisma.dish.findMany({
    where: { restaurantId: rest.id, isActive: true, deletedAt: null },
    select: { id: true, name: true, photos: true },
  });
  const stale = dishes.filter(d => {
    const p = (d.photos as string[])[0];
    return p && p.includes('lh3.googleusercontent.com');
  });
  console.log(`${stale.length} dishes with stale lh3 photos`);
  console.log(`Downloading ${Math.min(photoNames.length, stale.length)} photos to match...\n`);

  let updated = 0;
  for (let i = 0; i < Math.min(photoNames.length, stale.length); i++) {
    const dish = stale[i];
    const photoName = photoNames[i];
    
    // Get photo URL from Places API
    const photoUrl = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=1200&key=${API_KEY}&skipHttpRedirect=false`;
    process.stdout.write(`  [${dish.name.substring(0, 40)}] `);
    
    const buf = await fetchBuf(photoUrl);
    if (!buf) { console.log('SKIP (fetch failed)'); continue; }
    
    const meta = await sharp(buf).metadata();
    const optimized = await optimizeImage(buf);
    const fileName = `dishes/${rest.id}-sn17-${i}-${dish.id.slice(-6)}.webp`;
    
    const { error } = await supabase.storage.from('fotos').upload(fileName, optimized, { contentType: 'image/webp', upsert: true });
    if (error) { console.log(`SKIP (upload: ${error.message})`); continue; }
    
    const { data } = supabase.storage.from('fotos').getPublicUrl(fileName);
    await prisma.dish.update({ where: { id: dish.id }, data: { photos: [data.publicUrl] } });
    console.log(`OK (${meta.width}x${meta.height} → WebP)`);
    updated++;
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\nDone! Updated ${updated} photos.`);
  await prisma.$disconnect();
}
main().catch(console.error);
