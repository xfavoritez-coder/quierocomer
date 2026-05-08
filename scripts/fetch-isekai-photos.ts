/**
 * Auto-busca fotos en Unsplash para todos los platos de Isekai Ramen
 * que no tengan foto. Usa Anthropic para generar queries en inglés
 * por cada plato, busca en Unsplash, descarga y sube a Supabase.
 *
 * Uso:
 *   npx tsx scripts/fetch-isekai-photos.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const prisma = new PrismaClient();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY no definida");
if (!UNSPLASH_KEY) console.warn("UNSPLASH_ACCESS_KEY no definida — usando source.unsplash.com fallback");
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("SUPABASE creds no definidas");

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const SLUG = "isekai-ramen";

function dishSlug(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function generateQueries(dishes: { id: string; name: string; description: string | null }[]): Promise<{ id: string; query: string }[]> {
  // Procesar en lotes de 30 para que el modelo no se sature
  const BATCH = 30;
  const all: { id: string; query: string }[] = [];

  for (let i = 0; i < dishes.length; i += BATCH) {
    const batch = dishes.slice(i, i + BATCH);
    const dishList = batch.map(d => `- "${d.name}": ${d.description || "sin descripción"}`).join("\n");
    const prompt = `Para cada plato genera un query en inglés (max 4 palabras) optimizado para Unsplash. Específico al plato.

Platos:
${dishList}

Responde SOLO un JSON array: [{ "id": "...", "query": "..." }, ...]
IDs disponibles: ${batch.map(d => d.id).join(", ")}

Reglas:
- Para ramen, sushi, donburi, etc usa términos en inglés que matcheen comida japonesa
- Ej: "Tonkotsu Ramen" → "tonkotsu ramen bowl"
- Ej: "Nigiri Salmón" → "salmon nigiri sushi"
- Ej: "Limonada Yuzu" → "yuzu lemonade drink"
- Responde SOLO el JSON array`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Anthropic ${res.status}: ${errTxt}`);
    }
    const data = await res.json();
    const text = data.content?.[0]?.text || "";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) {
      console.warn(`Lote ${i / BATCH + 1}: no JSON, salto`);
      continue;
    }
    try {
      const arr = JSON.parse(match[0]) as { id: string; query: string }[];
      all.push(...arr);
    } catch (e) {
      console.warn(`Lote ${i / BATCH + 1}: JSON malformado, salto`);
    }
    console.log(`  · queries lote ${Math.floor(i / BATCH) + 1}: ${batch.length} platos`);
  }
  return all;
}

/** Busca en Unsplash con la query principal; si no hay resultado, prueba
 * con queries mas simples (1-2 palabras) hasta encontrar algo. */
async function searchUnsplash(query: string, dishName: string): Promise<string | null> {
  if (!UNSPLASH_KEY) {
    return `https://source.unsplash.com/800x600/?${encodeURIComponent(query + ",food,dish")}`;
  }

  const tryQuery = async (q: string): Promise<string | null> => {
    const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=1&orientation=landscape`, {
      headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.results?.[0]?.urls?.regular || null;
  };

  // 1. Query original + "food"
  let url = await tryQuery(query + " food");
  if (url) return url;

  // 2. Query original sin "food"
  url = await tryQuery(query);
  if (url) return url;

  // 3. Solo primeras 2 palabras
  const words = query.split(/\s+/);
  if (words.length > 2) {
    url = await tryQuery(words.slice(0, 2).join(" "));
    if (url) return url;
  }

  // 4. Fallbacks por categoria semantica del nombre del plato
  const lower = dishName.toLowerCase();
  let fallback: string | null = null;
  if (/ramen|miso|paitan|tonkotsu|shoyu|shio|tan-tan/.test(lower)) fallback = "ramen bowl";
  else if (/nigiri|sushi|sashimi|maki|gunkan|chirashi/.test(lower)) fallback = "sushi";
  else if (/yakimeshi|gohan|donburi|don\b/.test(lower)) fallback = "japanese rice bowl";
  else if (/karaage|tonkatsu|tebasaki/.test(lower)) fallback = "japanese fried chicken";
  else if (/gyosa|gyoza|takoyaki|edamame|okonomiyaki/.test(lower)) fallback = "japanese appetizer";
  else if (/mochi|taiyaki|dorayaki/.test(lower)) fallback = "japanese dessert";
  else if (/te\b|matcha|mugicha|genmaicha/.test(lower)) fallback = "japanese tea";
  else if (/limonada|jugo|mocktail|kombucha/.test(lower)) fallback = "fresh drink";
  else if (/topping|wakame|nori|kikurage|gari|moyashi|chashu|ajitama/.test(lower)) fallback = "japanese ingredient";

  if (fallback) {
    url = await tryQuery(fallback);
    if (url) return url;
  }

  // 5. Ultimo recurso: "japanese food"
  return tryQuery("japanese food");
}

async function reuploadToSupabase(externalUrl: string, restaurantId: string, dishName: string): Promise<string | null> {
  try {
    const res = await fetch(externalUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; QuieroComer/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 500) return null;

    let pipeline = sharp(buffer);
    const meta = await pipeline.metadata();
    if (!meta.format) return null;
    if ((meta.width && meta.width > 800) || (meta.height && meta.height > 800)) {
      pipeline = pipeline.resize(800, 800, { fit: "inside", withoutEnlargement: true });
    }
    const optimized = await pipeline.webp({ quality: 82 }).toBuffer();
    const fileName = `dishes/${restaurantId}-${Date.now()}-${dishSlug(dishName).slice(0, 30)}.webp`;
    const { error } = await supabase.storage.from("fotos").upload(fileName, optimized, { contentType: "image/webp", upsert: true });
    if (error) {
      console.error(`  · upload error ${dishName}: ${error.message}`);
      return null;
    }
    const { data } = supabase.storage.from("fotos").getPublicUrl(fileName);
    return data.publicUrl;
  } catch (e: any) {
    console.error(`  · ${dishName} reupload error: ${e?.message}`);
    return null;
  }
}

async function main() {
  const restaurant = await prisma.restaurant.findUnique({ where: { slug: SLUG } });
  if (!restaurant) throw new Error(`Restaurant slug=${SLUG} no encontrado`);

  const dishes = await prisma.dish.findMany({
    where: { restaurantId: restaurant.id, isActive: true, deletedAt: null },
    select: { id: true, name: true, description: true, photos: true },
    orderBy: { position: "asc" },
  });
  const needsPhotos = dishes.filter(d => !d.photos?.length);
  console.log(`Total platos: ${dishes.length} · Sin foto: ${needsPhotos.length}\n`);
  if (needsPhotos.length === 0) {
    console.log("Todos los platos ya tienen foto.");
    return;
  }

  console.log("Generando queries con Anthropic...");
  const queries = await generateQueries(needsPhotos);
  console.log(`✓ ${queries.length} queries generados\n`);

  console.log("Buscando fotos en Unsplash y subiendo a Supabase...");
  const queryById = new Map(queries.map(q => [q.id, q.query]));

  let ok = 0, fail = 0;
  const BATCH = 5;
  for (let i = 0; i < needsPhotos.length; i += BATCH) {
    const batch = needsPhotos.slice(i, i + BATCH);
    await Promise.all(batch.map(async (dish) => {
      const query = queryById.get(dish.id) || dish.name;
      const externalUrl = await searchUnsplash(query, dish.name);
      if (!externalUrl) {
        console.log(`  ✗ ${dish.name} (query: "${query}") — no se encontró foto`);
        fail++;
        return;
      }
      const finalUrl = await reuploadToSupabase(externalUrl, restaurant.id, dish.name) || externalUrl;
      await prisma.dish.update({ where: { id: dish.id }, data: { photos: [finalUrl] } });
      console.log(`  ✓ ${dish.name} (query: "${query}")`);
      ok++;
    }));
  }

  console.log(`\n✓ ${ok} platos con foto · ${fail} fallaron`);
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
