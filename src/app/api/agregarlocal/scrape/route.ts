import { NextResponse } from "next/server";
export const maxDuration = 120;

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
    const content = cleaned.length > 40000 ? cleaned.slice(0, 40000) : cleaned;

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
- Precios: enteros sin puntos ni símbolos. $8.990 → 8990
- Fotos: URL completa. Relativas → absolutas con ${baseUrl}
- No inventes datos. Responde SOLO el JSON`;

    const step1Text = await callClaude(step1Prompt);
    let parsed = parseJSON(step1Text);

    // Step 3: For catalog sites, fetch product sub-pages
    const isCatalog = parsed.type === "catalog";

    if (isCatalog) {
      const productLinks: { url: string; category: string; name: string }[] = [];
      for (const cat of (parsed.categories || [])) {
        for (const dish of (cat.dishes || [])) {
          if (dish.productUrl) {
            const absUrl = dish.productUrl.startsWith("http") ? dish.productUrl : `${baseUrl}${dish.productUrl.startsWith("/") ? "" : "/"}${dish.productUrl}`;
            productLinks.push({ url: absUrl, category: cat.name, name: dish.name });
          }
        }
      }

      // Cap at 60 products to stay within timeout
      const linksToFetch = productLinks.slice(0, 60);

      if (linksToFetch.length > 0) {
        // Fetch sub-pages in parallel batches of 10
        const productPages: { category: string; content: string }[] = [];
        const BATCH = 10;
        for (let i = 0; i < linksToFetch.length; i += BATCH) {
          const batch = linksToFetch.slice(i, i + BATCH);
          const results = await Promise.allSettled(batch.map(async (link) => {
            const pg = await fetchPage(link.url);
            return { category: link.category, content: cleanContent(pg).slice(0, 3000) };
          }));
          for (const r of results) {
            if (r.status === "fulfilled") productPages.push(r.value);
          }
        }

        if (productPages.length > 0) {
          // Extract dish data from product pages — batches of 12 to Claude
          const EXTRACT_BATCH = 12;
          const allDishes: { category: string; dish: any }[] = [];

          for (let i = 0; i < productPages.length; i += EXTRACT_BATCH) {
            const batch = productPages.slice(i, i + EXTRACT_BATCH);
            const batchContent = batch.map((p, idx) => `--- PRODUCTO ${idx + 1} (Categoría: ${p.category}) ---\n${p.content}`).join("\n\n");

            try {
              const extractText = await callClaude(`Extrae la información de estos ${batch.length} productos de restaurante.

${batchContent}

Responde con un JSON:
{
  "dishes": [
    {
      "category": "Categoría original",
      "name": "Nombre del plato",
      "description": "Descripción completa, null si no tiene",
      "price": 8990,
      "photo": "URL completa de la foto principal, null si no tiene",
      "diet": "OMNIVORE" | "VEGAN" | "VEGETARIAN",
      "isSpicy": false,
      "modifiers": [
        { "name": "Grupo de opciones", "required": true, "options": [{ "name": "Opción", "price": 0 }] }
      ]
    }
  ]
}

Precios enteros ($8.990 → 8990). No inventes datos. Responde SOLO el JSON`);
              const extractParsed = parseJSON(extractText);
              for (const dish of (extractParsed.dishes || [])) {
                allDishes.push({ category: dish.category, dish });
              }
            } catch { /* continue */ }
          }

          // Rebuild categories if we got sub-page data
          if (allDishes.length > 0) {
            const catMap = new Map<string, any>();
            for (const cat of (parsed.categories || [])) {
              catMap.set(cat.name, { name: cat.name, type: cat.type || "food", dishes: [] });
            }
            for (const { category, dish } of allDishes) {
              const cat = catMap.get(category) || { name: category, type: "food", dishes: [] };
              const { category: _, ...dishData } = dish;
              cat.dishes.push(dishData);
              catMap.set(category, cat);
            }
            parsed.categories = Array.from(catMap.values());
          }
          // If allDishes is empty, keep the original parsed categories (partial data is better than nothing)
        }
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
