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

async function fetchPage(url: string): Promise<string> {
  // Try Jina Reader first (renders JS), fallback to direct fetch
  try {
    const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
      headers: { "Accept": "text/plain", "X-No-Cache": "true" },
    });
    if (jinaRes.ok) return await jinaRes.text();
  } catch {}
  const directRes = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; QuieroComer/1.0)" },
    redirect: "follow",
  });
  if (!directRes.ok) throw new Error(`HTTP ${directRes.status}`);
  return await directRes.text();
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
  // Fix truncated JSON
  jsonStr = jsonStr.replace(/,\s*\{[^}]*$/, "").replace(/,\s*"[^"]*$/, "").replace(/,\s*$/, "");
  let o = 0, c = 0; for (const ch of jsonStr) { if (ch === "[") o++; if (ch === "]") c++; }
  for (let i = 0; i < o - c; i++) jsonStr += "]";
  o = 0; c = 0; for (const ch of jsonStr) { if (ch === "{") o++; if (ch === "}") c++; }
  for (let i = 0; i < o - c; i++) jsonStr += "}";
  return JSON.parse(jsonStr);
}

/** Fetch product sub-pages in parallel batches */
async function fetchProductPages(links: { url: string; category: string }[], baseUrl: string): Promise<{ category: string; content: string }[]> {
  const results: { category: string; content: string }[] = [];
  const BATCH = 8;
  for (let i = 0; i < links.length; i += BATCH) {
    const batch = links.slice(i, i + BATCH);
    const fetched = await Promise.allSettled(batch.map(async (link) => {
      const content = await fetchPage(link.url);
      return { category: link.category, content: cleanContent(content) };
    }));
    for (const r of fetched) {
      if (r.status === "fulfilled") results.push(r.value);
    }
  }
  return results;
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

    // Step 2: Ask Claude to extract categories + product links (or full dishes if inline)
    const step1Prompt = `Analiza esta página de menú de restaurante y extrae la información.

URL: ${url}
${providedName ? `Nombre del local: ${providedName}` : ""}

Contenido:
${content}

IMPORTANTE: Hay dos tipos de páginas de menú:
1. Menú completo inline: todos los platos con precio/descripción están en esta página
2. Menú tipo catálogo: solo muestra categorías con links a cada producto individual

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
- type "catalog": cuando las categorías solo tienen nombres/links de productos sin descripciones completas. Incluye productUrl para cada plato
- type "inline": cuando los platos tienen toda su info (precio, descripción) visible en esta página. productUrl debe ser null
- Precios: enteros sin puntos ni símbolos. $8.990 → 8990. Si no hay precio visible, pon 0
- Fotos: URL completa. URLs relativas → absolutas usando ${baseUrl}
- Logo: busca en meta tags, favicon, imgs con logo/brand
- No inventes datos. Responde SOLO el JSON`;

    const step1Text = await callClaude(step1Prompt);
    let parsed = parseJSON(step1Text);

    // Step 3: If catalog type, fetch product sub-pages for details
    const isCatalog = parsed.type === "catalog";
    const productLinks: { url: string; category: string }[] = [];

    if (isCatalog) {
      for (const cat of (parsed.categories || [])) {
        for (const dish of (cat.dishes || [])) {
          if (dish.productUrl) {
            // Make absolute URL
            const absUrl = dish.productUrl.startsWith("http") ? dish.productUrl : `${baseUrl}${dish.productUrl.startsWith("/") ? "" : "/"}${dish.productUrl}`;
            productLinks.push({ url: absUrl, category: cat.name });
          }
        }
      }
    }

    if (productLinks.length > 0) {
      // Fetch all product pages
      const productPages = await fetchProductPages(productLinks, baseUrl);

      // Batch product pages and send to Claude for extraction (groups of 10)
      const EXTRACT_BATCH = 10;
      const allDishes: { category: string; dish: any }[] = [];

      for (let i = 0; i < productPages.length; i += EXTRACT_BATCH) {
        const batch = productPages.slice(i, i + EXTRACT_BATCH);
        const batchContent = batch.map((p, idx) => `--- PRODUCTO ${idx + 1} (Categoría: ${p.category}) ---\n${p.content.slice(0, 3000)}`).join("\n\n");

        const extractPrompt = `Extrae la información de estos ${batch.length} productos de restaurante.

${batchContent}

Para cada producto responde con un JSON:
{
  "dishes": [
    {
      "category": "Nombre de la categoría original",
      "name": "Nombre del plato",
      "description": "Descripción completa, null si no tiene",
      "price": 8990,
      "photo": "URL completa de la foto principal, null si no tiene",
      "diet": "OMNIVORE" | "VEGAN" | "VEGETARIAN",
      "isSpicy": false,
      "modifiers": [
        {
          "name": "Nombre del grupo (ej: Cocción, Tamaño, Extras)",
          "required": true,
          "options": [{ "name": "Opción", "price": 0 }]
        }
      ]
    }
  ]
}

Reglas:
- Precios enteros: $8.990 → 8990
- Fotos: URL completa, no placeholders
- Modificadores: solo si hay opciones/extras reales en el contenido
- Precio de modificadores es el ADICIONAL (0 si no tiene costo extra)
- No inventes datos. Responde SOLO el JSON`;

        try {
          const extractText = await callClaude(extractPrompt);
          const extractParsed = parseJSON(extractText);
          for (const dish of (extractParsed.dishes || [])) {
            allDishes.push({ category: dish.category, dish });
          }
        } catch { /* continue with what we have */ }
      }

      // Rebuild categories from extracted dishes
      const catMap = new Map<string, any>();
      // Keep original category order and type
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
        withPhoto,
        withoutPhoto,
        totalDishes,
        totalCategories: (parsed.categories || []).length,
        type: isCatalog ? "catalog" : "inline",
        productPagesFetched: productLinks.length,
        filledWithUnsplash: (parsed.categories || []).flatMap((c: any) => c.dishes || []).filter((d: any) => d._unsplash).length,
      },
    });
  } catch (e: any) {
    console.error("[scrape]", e);
    return NextResponse.json({ error: e.message || "Error" }, { status: 500 });
  }
}
