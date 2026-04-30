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

// Domains where direct HTML fetch works better than Jina (server-rendered menu platforms)
const DIRECT_FETCH_DOMAINS = [
  "queresto.com",
  "thefork.com",
  "lafourchette.com",
];

// Domains where Jina is required (heavy JS rendering)
const JINA_FIRST_DOMAINS = [
  "fudo.com",
  "fudo.cl",
  "meitre.com",
  "toteat.app",
  "justo.app",
];

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

async function fetchPage(url: string): Promise<string> {
  const domain = getDomain(url);
  const preferDirect = DIRECT_FETCH_DOMAINS.some(d => domain.includes(d));
  const preferJina = JINA_FIRST_DOMAINS.some(d => domain.includes(d));

  if (preferDirect) {
    // Direct first — these platforms server-render with prices/photos in HTML
    try {
      const direct = await fetchWithTimeout(url, 10000);
      if (direct.length > 500) return direct;
    } catch {}
    try { return await fetchWithTimeout(`https://r.jina.ai/${url}`, 12000); } catch {}
    return await fetchWithTimeout(url, 8000);
  }

  if (preferJina) {
    // Jina first — these need JS rendering
    try { return await fetchWithTimeout(`https://r.jina.ai/${url}`, 12000); } catch {}
    return await fetchWithTimeout(url, 8000);
  }

  // Unknown domain: try both, pick the one with more content
  let jinaContent = "";
  let directContent = "";
  try { jinaContent = await fetchWithTimeout(`https://r.jina.ai/${url}`, 12000); } catch {}
  try { directContent = await fetchWithTimeout(url, 8000); } catch {}

  if (!jinaContent && !directContent) throw new Error("No se pudo acceder a la URL");

  // Prefer whichever has more price-like patterns (indicates real menu data)
  const pricePattern = /\$[\d.,]+|\d{3,6}/g;
  const jinaPrices = (jinaContent.match(pricePattern) || []).length;
  const directPrices = (directContent.match(pricePattern) || []).length;

  // If direct has significantly more prices, use it (better structured data)
  if (directPrices > jinaPrices * 1.5 && directContent.length > 500) return directContent;
  // Otherwise prefer Jina (cleaner markdown)
  return jinaContent || directContent;
}

function cleanContent(html: string): string {
  // Extract image URLs before stripping tags
  const imgUrls: string[] = [];
  const imgMatches = html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi);
  for (const m of imgMatches) {
    const src = m[1];
    if (src && !src.includes("favicon") && !src.includes("logo") && !src.includes("icon") && !src.includes("data:image") && src.length > 10) {
      imgUrls.push(src);
    }
  }

  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    // Preserve price-like patterns by converting spans/divs with prices to text
    .replace(/<[^>]*>\s*(\$[\d.,]+)\s*<\/[^>]*>/gi, " $1 ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/ {2,}/g, " ")
    .trim();

  // Append found image URLs so Claude can reference them
  if (imgUrls.length > 0) {
    cleaned += "\n\n[IMAGES FOUND ON PAGE]\n" + imgUrls.slice(0, 80).join("\n");
  }

  return cleaned;
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
    let fetchedCatData: any[] = [];

    if (isCatalog) {
      // FAST PATH: skip first Claude call, detect categories from markdown, fetch category pages directly
      const nameMatch = cleaned.match(/^#\s+(.+)/m);
      const logoMatch = cleaned.match(/og:image[^>]*content="([^"]+)"/i) || cleaned.match(/!\[.*?logo.*?\]\((https?:\/\/[^\s)]+)\)/i);
      const skipCats = new Set(["Destacados", "Resultados de la búsqueda", "destacados", "resultados de la búsqueda"]);
      // Filter out page titles / non-category headers (contain "menú", "pide", "precios", etc.)
      const titlePatterns = /menú|menu|pide|precio|teléfono|pedido|delivery|dirección|horario|información/i;
      const categories = catHeaders.filter(n => !skipCats.has(n) && !titlePatterns.test(n)).map(name => {
        const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        return { name, type: "food" as const, slug, categoryUrl: `${baseUrl}/${slug}`, dishes: [] as any[] };
      });

      // Fetch all category pages in parallel
      const catResults = await Promise.allSettled(categories.map(async (cat) => {
        const rawContent = await fetchPage(cat.categoryUrl);
        const content = cleanContent(rawContent);
        // Extract product links from category page
        const productLinks = [...content.matchAll(/\]\((https?:\/\/[^\s)]+\/[^\s/)]+)\)/g)]
          .map(m => m[1])
          .filter(u => u.includes(baseUrl) && u !== baseUrl + "/");
        return { catName: cat.name, content: content.slice(0, 4000), productLinks: [...new Set(productLinks)] };
      }));
      const fetched = catResults.filter(r => r.status === "fulfilled").map(r => (r as any).value).filter((f: any) => f.content.length > 50);
      fetchedCatData = fetched;

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

REGLAS:
- Precios enteros: $8.990→8990, $12.500→12500 (punto es separador de miles, NO decimal)
- NO dejes price en 0 si hay un precio visible
- Fotos: busca URLs de imágenes en [IMAGES FOUND ON PAGE] y asócialas por nombre/posición
- URLs absolutas con ${baseUrl}
- SOLO JSON

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

REGLAS IMPORTANTES:
- Precios: busca números que parezcan precios (ej: $8.990, 8990, $12.500). Conviértelos a enteros sin puntos: $8.990→8990
- Si un precio tiene formato "8.990" (con punto de miles), es 8990 no 8.99
- Fotos: busca URLs de imágenes en la sección [IMAGES FOUND ON PAGE] y asócialas al plato correspondiente por nombre o posición
- Las URLs de fotos deben ser absolutas. Si son relativas, añade ${baseUrl} al inicio
- NO dejes price en 0 si hay un precio visible en la página
- SOLO JSON, sin texto adicional.`);
      parsed = parseJSON(step1Text);
      parsed.type = "inline";
    }

    // Fetch photos from product sub-pages via direct HTML
    if (isCatalog && fetchedCatData.length > 0) {
      // Build map: product URL → dish name (from category page links)
      const allProductUrls = new Map<string, string[]>(); // url → [catName]
      for (const f of fetchedCatData) {
        for (const link of (f.productLinks || [])) {
          if (!allProductUrls.has(link)) allProductUrls.set(link, []);
          allProductUrls.get(link)!.push(f.catName);
        }
      }

      // Fetch all product pages in parallel (direct HTML, no Jina — 10s timeout)
      const photoMap = new Map<string, string>(); // product URL → photo URL
      const urls = [...allProductUrls.keys()];
      const PHOTO_BATCH = 20;
      for (let pi = 0; pi < urls.length; pi += PHOTO_BATCH) {
        const batch = urls.slice(pi, pi + PHOTO_BATCH);
        await Promise.allSettled(batch.map(async (productUrl) => {
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 10000);
            const res = await fetch(productUrl, { signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; QuieroComer/1.0)" } });
            const html = await res.text();
            clearTimeout(timer);
            const imgMatch = html.match(/src="(https?:\/\/[^"]+\.(?:webp|jpg|jpeg|png))"/i);
            const found = imgMatch?.[1];
            if (found && !found.includes("favicon") && !found.includes("logo") && !found.includes("default")) {
              photoMap.set(productUrl, found);
            }
          } catch {}
        }));
      }

      // Match photos to dishes by name (product URL slug ≈ dish name slug)
      for (const cat of (parsed.categories || [])) {
        for (const dish of (cat.dishes || [])) {
          if (dish.photo) continue;
          // Try productUrl first
          if (dish.productUrl && photoMap.has(dish.productUrl)) {
            dish.photo = photoMap.get(dish.productUrl);
            continue;
          }
          // Match by dish name slug in URL
          const dishSlug = (dish.name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
          if (dishSlug.length < 2) continue;
          for (const [pUrl, pPhoto] of photoMap) {
            if (pUrl.toLowerCase().includes(dishSlug) || dishSlug.includes(pUrl.split("/").pop()?.toLowerCase() || "___")) {
              dish.photo = pPhoto;
              break;
            }
          }
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
