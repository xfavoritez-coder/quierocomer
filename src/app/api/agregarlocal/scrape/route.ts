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
    const startTime = Date.now();

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

    // Detect catalog vs inline from markdown structure (no Claude needed)
    const catHeaders = [...cleaned.matchAll(/^#{1,2}\s+(.+)$/gm)].map(m => m[1].trim()).filter(n => n.length > 1 && n.length < 60);
    const hasProductLinks = /\]\(https?:\/\/[^\s)]+\/[^\s/)]+\)/i.test(cleaned);
    const sections = cleaned.split(/^#{1,2}\s+/gm).slice(1);
    const emptySections = sections.filter(s => !s.includes("$") && s.trim().length < 100).length;
    const isCatalog = catHeaders.length >= 4 && emptySections > catHeaders.length * 0.4 && hasProductLinks;

    let parsed: any;

    if (isCatalog) {
      // FAST PATH: skip first Claude call, detect categories from markdown, fetch category pages directly
      const nameMatch = cleaned.match(/^#\s+(.+)/m);
      const logoMatch = cleaned.match(/og:image[^>]*content="([^"]+)"/i) || cleaned.match(/!\[.*?logo.*?\]\((https?:\/\/[^\s)]+)\)/i);
      const skipCats = new Set(["Destacados", "Resultados de la búsqueda", "destacados"]);
      const categories = catHeaders.filter(n => !skipCats.has(n)).map(name => {
        const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        return { name, type: "food" as const, slug, categoryUrl: `${baseUrl}/${slug}`, dishes: [] as any[] };
      });

      // Fetch all category pages in parallel
      const catResults = await Promise.allSettled(categories.map(async (cat) => {
        const content = await fetchPage(cat.categoryUrl);
        return { catName: cat.name, content: cleanContent(content).slice(0, 4000) };
      }));
      const fetched = catResults.filter(r => r.status === "fulfilled").map(r => (r as any).value).filter((f: any) => f.content.length > 50);

      // Send to Claude in parallel batches
      if (fetched.length > 0) {
        const CAT_BATCH = 10;
        const claudePromises = [];
        for (let ci = 0; ci < fetched.length; ci += CAT_BATCH) {
          const batch = fetched.slice(ci, ci + CAT_BATCH);
          const batchContent = batch.map((f: any) => `--- CATEGORÍA: ${f.catName} ---\n${f.content}`).join("\n\n");
          claudePromises.push(
            callClaude(`Extrae TODOS los productos de estas ${batch.length} categorías de restaurante. Responde con JSON:
{"categories":[{"name":"Nombre categoría","dishes":[{"name":"Nombre","description":"Desc o null","price":8990,"photo":null,"productUrl":"URL producto o null","diet":"OMNIVORE","isSpicy":false,"modifiers":[]}]}]}
Precios enteros ($8.990→8990). URLs absolutas con ${baseUrl}. SOLO JSON.

${batchContent}`, 16000)
              .then(text => parseJSON(text))
              .catch(() => ({ categories: [] }))
          );
        }
        const results = await Promise.all(claudePromises);
        for (const res of results) {
          for (const newCat of (res.categories || [])) {
            const existing = categories.find(c => c.name === newCat.name);
            if (existing) existing.dishes = newCat.dishes || [];
            else categories.push({ ...newCat, type: "food", slug: "", categoryUrl: "", dishes: newCat.dishes || [] });
          }
        }
      }

      parsed = {
        restaurantName: nameMatch?.[1]?.replace(/ - .+$/, "").trim() || providedName || "Sin nombre",
        logo: logoMatch?.[1] || null,
        type: "catalog",
        categories,
      };
    } else {
      // INLINE: use Claude to extract everything from the page
      const content = cleaned.length > 20000 ? cleaned.slice(0, 20000) : cleaned;
      const step1Text = await callClaude(`Analiza esta página de menú de restaurante y extrae toda la información.
URL: ${url}
${providedName ? `Nombre: ${providedName}` : ""}
Contenido:
${content}

Responde con JSON:
{"restaurantName":"...","logo":"URL o null","categories":[{"name":"...","type":"food"|"drink"|"dessert","dishes":[{"name":"...","description":"...","price":8990,"photo":"URL o null","diet":"OMNIVORE","isSpicy":false,"modifiers":[]}]}]}
Precios enteros ($8.990→8990). Fotos absolutas con ${baseUrl}. SOLO JSON.`);
      parsed = parseJSON(step1Text);
      parsed.type = "inline";
    }

    // Fetch photos from product sub-pages via direct HTML — only if enough time budget
    const elapsed = Date.now() - startTime;
    const TIME_BUDGET = 80000; // leave 40s buffer for response
    const dishesNeedingPhotos: { dish: any; url: string }[] = [];
    for (const cat of (parsed.categories || [])) {
      for (const dish of (cat.dishes || [])) {
        if (!dish.photo && dish.productUrl) {
          const absUrl = dish.productUrl.startsWith("http") ? dish.productUrl : `${baseUrl}${dish.productUrl.startsWith("/") ? "" : "/"}${dish.productUrl}`;
          dishesNeedingPhotos.push({ dish, url: absUrl });
        }
      }
    }
    if (dishesNeedingPhotos.length > 0 && elapsed < TIME_BUDGET) {
      // All in one parallel round with tight timeout
      await Promise.allSettled(dishesNeedingPhotos.map(async ({ dish, url }) => {
        try {
          const html = await fetchWithTimeout(url, 5000);
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
