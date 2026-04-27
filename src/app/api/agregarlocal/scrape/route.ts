import { NextResponse } from "next/server";
export const maxDuration = 300;

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;
const MODEL = "claude-sonnet-4-6";

async function searchUnsplash(query: string): Promise<string | null> {
  if (!UNSPLASH_KEY) return null;
  try {
    const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query + " food")}&per_page=1&orientation=landscape`, {
      headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.results?.[0]?.urls?.regular || null;
  } catch { return null; }
}

async function fetchWithTimeout(url: string, timeoutMs = 10000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { "Accept": "text/plain", "X-No-Cache": "true" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally { clearTimeout(timer); }
}

async function fetchPage(url: string): Promise<string> {
  try {
    return await fetchWithTimeout(`https://r.jina.ai/${url}`, 12000);
  } catch {}
  return await fetchWithTimeout(url, 8000);
}

function cleanContent(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/ {2,}/g, " ")
    .trim();
}

async function callClaude(prompt: string, maxTokens = 16000): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Claude error: ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

function parseJSON(text: string): any {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found");
  let jsonStr = match[0];
  try { return JSON.parse(jsonStr); } catch {}
  jsonStr = jsonStr.replace(/,\s*\{[^}]*$/, "").replace(/,\s*"[^"]*$/, "").replace(/,\s*$/, "");
  let o = 0, c = 0; for (const ch of jsonStr) { if (ch === "[") o++; if (ch === "]") c++; }
  for (let i = 0; i < o - c; i++) jsonStr += "]";
  o = 0; c = 0; for (const ch of jsonStr) { if (ch === "{") o++; if (ch === "}") c++; }
  for (let i = 0; i < o - c; i++) jsonStr += "}";
  return JSON.parse(jsonStr);
}

export async function POST(request: Request) {
  try {
    if (!ANTHROPIC_API_KEY) return NextResponse.json({ error: "API not configured" }, { status: 500 });

    const { url, name: providedName } = await request.json();
    if (!url?.trim()) return NextResponse.json({ error: "URL requerida" }, { status: 400 });

    const baseUrl = new URL(url).origin;

    // Step 1: Fetch main page
    let pageContent: string;
    try {
      pageContent = await fetchPage(url);
    } catch (e: any) {
      return NextResponse.json({ error: `No se pudo acceder a la URL: ${e.message}` }, { status: 400 });
    }

    const cleaned = cleanContent(pageContent);
    const content = cleaned.length > 20000 ? cleaned.slice(0, 20000) : cleaned;

    // Step 2: Claude extracts categories + detects inline vs catalog
    const step1Prompt = `Analiza esta página de menú de restaurante y extrae la información.

URL: ${url}
${providedName ? `Nombre del local: ${providedName}` : ""}

Contenido:
${content}

IMPORTANTE: Hay dos tipos de páginas de menú:
1. "inline": todos los platos con precio y descripción están en esta página
2. "catalog": solo muestra categorías con links a páginas individuales de cada producto

Responde con un JSON:
{
  "restaurantName": "Nombre del restaurante",
  "logo": "URL del logo si lo encuentras, null si no",
  "type": "inline" | "catalog",
  "categories": [
    {
      "name": "Nombre de la categoría",
      "type": "food" | "drink" | "dessert",
      "dishes": [
        {
          "name": "Nombre del plato",
          "description": "Descripción si la tiene, null si no",
          "price": 8990,
          "photo": "URL completa de la foto, null si no tiene",
          "diet": "OMNIVORE" | "VEGAN" | "VEGETARIAN",
          "isSpicy": false,
          "modifiers": [],
          "productUrl": "URL de la página individual del producto si es catálogo, null si es inline"
        }
      ]
    }
  ]
}

Reglas:
- type "catalog": categorías con links de productos sin descripciones completas. Incluye productUrl
- type "inline": platos con toda su info visible. productUrl = null
- Para categorías vacías (sin platos visibles pero que aparecen como secciones): incluye la categoría con dishes vacío y agrega un campo "categoryUrl" con la URL probable de esa sección (basándote en el patrón de URLs de la página, ej: si la URL base es example.com/products y la categoría es "California Roll", la URL podría ser example.com/california-roll)
- Precios: enteros sin puntos ni símbolos. $8.990 → 8990
- Fotos: URL completa. Relativas → absolutas con ${baseUrl}
- No inventes datos. Responde SOLO el JSON`;

    const step1Text = await callClaude(step1Prompt);
    let parsed = parseJSON(step1Text);

    // Step 3: For catalog sites, fetch product sub-pages
    const isCatalog = parsed.type === "catalog";

    if (isCatalog) {
      // Fetch ALL empty category pages in parallel (single round, ~12s total)
      const emptyCategories = (parsed.categories || []).filter((c: any) => (!c.dishes || c.dishes.length === 0) && c.categoryUrl);
      if (emptyCategories.length > 0) {
        const catResults = await Promise.allSettled(emptyCategories.map(async (cat: any) => {
          const catUrl = cat.categoryUrl.startsWith("http") ? cat.categoryUrl : `${baseUrl}${cat.categoryUrl.startsWith("/") ? "" : "/"}${cat.categoryUrl}`;
          const catContent = await fetchPage(catUrl);
          return { catName: cat.name, catType: cat.type, content: cleanContent(catContent).slice(0, 4000) };
        }));
        const fetched = catResults.filter(r => r.status === "fulfilled").map(r => (r as any).value);

        // Send category contents to Claude in parallel batches (~8 cats each)
        if (fetched.length > 0) {
          const CAT_BATCH = 8;
          const claudePromises = [];
          for (let ci = 0; ci < fetched.length; ci += CAT_BATCH) {
            const batch = fetched.slice(ci, ci + CAT_BATCH);
            const batchContent = batch.map((f: any) => `--- CATEGORÍA: ${f.catName} ---\n${f.content}`).join("\n\n");
            claudePromises.push(
              callClaude(`Extrae TODOS los productos de estas ${batch.length} categorías de restaurante.

${batchContent}

Responde con un JSON:
{
  "categories": [
    {
      "name": "Nombre exacto de la categoría",
      "dishes": [
        { "name": "Nombre", "description": "Descripción o null", "price": 8990, "photo": "URL foto o null", "diet": "OMNIVORE", "isSpicy": false, "modifiers": [] }
      ]
    }
  ]
}

Precios enteros ($8.990 → 8990). Fotos: URLs absolutas con ${baseUrl}. Responde SOLO el JSON`, 16000)
                .then(text => parseJSON(text))
                .catch(() => ({ categories: [] }))
            );
          }
          const claudeResults = await Promise.all(claudePromises);
          for (const catParsed of claudeResults) {
            for (const newCat of (catParsed.categories || [])) {
              const existing = parsed.categories.find((c: any) => c.name === newCat.name);
              if (existing) {
                existing.dishes = [...(existing.dishes || []), ...(newCat.dishes || [])];
              } else {
                const typeInfo = fetched.find((f: any) => f.catName === newCat.name);
                parsed.categories.push({ ...newCat, type: typeInfo?.catType || "food" });
              }
            }
          }
        }
      }
    }

    // Fetch photos from product sub-pages via direct HTML (not Jina — more reliable for images)
    const dishesNeedingPhotos: { dish: any; url: string }[] = [];
    for (const cat of (parsed.categories || [])) {
      for (const dish of (cat.dishes || [])) {
        if (!dish.photo && dish.productUrl) {
          const absUrl = dish.productUrl.startsWith("http") ? dish.productUrl : `${baseUrl}${dish.productUrl.startsWith("/") ? "" : "/"}${dish.productUrl}`;
          dishesNeedingPhotos.push({ dish, url: absUrl });
        }
      }
    }
    if (dishesNeedingPhotos.length > 0) {
      const PHOTO_BATCH = 15;
      for (let i = 0; i < dishesNeedingPhotos.length; i += PHOTO_BATCH) {
        const batch = dishesNeedingPhotos.slice(i, i + PHOTO_BATCH);
        await Promise.allSettled(batch.map(async ({ dish, url }) => {
          try {
            const html = await fetchWithTimeout(url, 6000);
            // Extract from <img src="..."> or og:image meta tag
            const ogMatch = html.match(/property="og:image"[^>]*content="([^"]+)"/i)
              || html.match(/content="([^"]+)"[^>]*property="og:image"/i);
            const imgMatch = html.match(/src="(https?:\/\/[^"]+\.(?:webp|jpg|jpeg|png))"/i);
            const found = ogMatch?.[1] || imgMatch?.[1];
            if (found && !found.includes("favicon") && !found.includes("logo") && !found.includes("default")) {
              dish.photo = found;
            }
          } catch {}
        }));
      }
    }

    // Remove empty categories
    parsed.categories = (parsed.categories || []).filter((c: any) => c.dishes?.length > 0);

    // Count photos
    let withPhoto = 0, withoutPhoto = 0;
    for (const cat of (parsed.categories || [])) {
      for (const dish of (cat.dishes || [])) {
        if (dish.photo) withPhoto++; else withoutPhoto++;
      }
    }

    // Fill missing photos with Unsplash (max 10)
    if (withoutPhoto > 0 && UNSPLASH_KEY) {
      const needPhotos = [];
      for (const cat of (parsed.categories || [])) {
        for (const dish of (cat.dishes || [])) {
          if (!dish.photo) needPhotos.push(dish);
        }
      }
      for (const dish of needPhotos.slice(0, 10)) {
        const query = (dish.name || "").replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ\s]/g, "").trim();
        if (!query) continue;
        const photo = await searchUnsplash(query);
        if (photo) { dish.photo = photo; dish._unsplash = true; }
      }
    }

    const totalDishes = (parsed.categories || []).reduce((a: number, c: any) => a + (c.dishes?.length || 0), 0);

    return NextResponse.json({
      ...parsed,
      restaurantName: parsed.restaurantName || providedName || "Sin nombre",
      stats: {
        withPhoto, withoutPhoto, totalDishes,
        totalCategories: (parsed.categories || []).length,
        type: isCatalog ? "catalog" : "inline",
        productPagesFetched: isCatalog ? Math.min((parsed.categories || []).flatMap((c: any) => c.dishes || []).length, 60) : 0,
        filledWithUnsplash: (parsed.categories || []).flatMap((c: any) => c.dishes || []).filter((d: any) => d._unsplash).length,
      },
    });
  } catch (e: any) {
    console.error("[scrape]", e);
    return NextResponse.json({ error: e.message || "Error al procesar la página" }, { status: 500 });
  }
}
