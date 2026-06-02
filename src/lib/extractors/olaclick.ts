/**
 * OlaClick extractor.
 * OlaClick is a Vue.js/Nuxt SPA — products load dynamically via JS with lazy loading.
 * Only the first category renders on /products; the rest load on scroll.
 *
 * Strategy:
 * 1. Fetch /products with Jina → get first category + extract category slugs from links
 * 2. Fetch each category page individually (/{cat-slug}) via Jina
 * 3. Combine all content and extract with Claude
 *
 * Menu URL pattern: https://{slug}.ola.click/products
 */

import type { ExtractionResult, ExtractedDish } from "./types";

function getApiKey() { return process.env.ANTHROPIC_API_KEY; }
const MODEL = "claude-sonnet-4-6";

/** Ensure the URL points to /products page where actual dishes are */
function resolveProductsUrl(cartaUrl: string): string {
  try {
    const url = new URL(cartaUrl);
    if (!url.pathname.includes("/products") && !url.pathname.includes("/promociones")) {
      url.pathname = "/products";
    }
    return url.toString();
  } catch { return cartaUrl; }
}

/** Fetch root page HTML — used for logo extraction and category slug discovery */
async function fetchRootHtml(cartaUrl: string): Promise<string> {
  try {
    const rootUrl = new URL(cartaUrl).origin;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(rootUrl, { signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0" } });
    clearTimeout(timer);
    return await res.text();
  } catch {}
  return "";
}

/** Extract logo from root page NUXT data */
function extractLogoFromHtml(html: string): string | null {
  const logoMatch = html.match(/logo_url\s*:\s*"([^"]+)"/);
  if (logoMatch) return logoMatch[1].replace(/\\u002F/g, "/");
  const logoMatch2 = html.match(/logo_thumbnail_url\s*:\s*"([^"]+)"/);
  if (logoMatch2) return logoMatch2[1].replace(/\\u002F/g, "/");
  return null;
}

/** Extract category slugs from NUXT __data by looking for route-like strings */
function extractSlugsFromNuxtHtml(html: string, origin: string): string[] {
  const slugs = new Set<string>();
  // Match hrefs and route patterns pointing to /{slug} on the same origin
  const hostPattern = origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const linkRe = new RegExp(`(?:${hostPattern}|href="|")/([a-z][a-z0-9-]{2,30})(?:/|"|'|\\s)`, "gi");
  let m;
  while ((m = linkRe.exec(html)) !== null) {
    const s = m[1].toLowerCase();
    if (!["products", "info", "checkout", "login", "register", "cart", "_nuxt", "api", "css", "img", "js", "fonts"].includes(s)) {
      slugs.add(s);
    }
  }
  return [...slugs];
}

async function fetchJina(url: string, headers: Record<string, string>, timeoutMs = 40000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      signal: controller.signal,
      headers: { Accept: "text/plain", ...headers },
    });
    if (!res.ok) throw new Error(`Jina HTTP ${res.status}`);
    return await res.text();
  } finally { clearTimeout(timer); }
}

/** Fetch a single page with Jina, return content if it has prices */
async function fetchPage(url: string): Promise<string> {
  const attempts: { headers: Record<string, string>; label: string }[] = [
    { headers: { "X-Timeout": "30000", "X-No-Cache": "true" }, label: "default" },
    { headers: { "X-Wait-For-Selector": ".infinite-products", "X-Timeout": "30000", "X-No-Cache": "true" }, label: "wait-infinite" },
  ];

  for (const { headers, label } of attempts) {
    try {
      const text = await fetchJina(url, headers);
      const hasPrices = /\$\s*[\d.,]+/.test(text);
      if (hasPrices && text.length > 200) return text;
    } catch {}
  }
  return "";
}

/** Extract category slugs from OlaClick product links in rendered content.
 *  Links look like: https://{store}.ola.click/{category-slug}/{product-slug}
 */
function extractCategorySlugs(content: string, origin: string): string[] {
  // Match links like /tablas/24-cortes-mixtos or full URLs
  const linkPattern = new RegExp(`(?:${origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})?/([a-z0-9-]+)/[a-z0-9-]+`, "gi");
  const slugs = new Set<string>();
  let match;
  while ((match = linkPattern.exec(content)) !== null) {
    const slug = match[1].toLowerCase();
    // Skip known non-category paths
    if (["products", "info", "checkout", "login", "register", "cart", "_nuxt", "api"].includes(slug)) continue;
    slugs.add(slug);
  }
  return [...slugs];
}

async function callClaude(prompt: string): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 32000, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Claude error: ${res.status}`);
  const data = await res.json();
  import("@/lib/costTracker").then(m => m.logClaudeUsage({ model: MODEL, inputTokens: data.usage?.input_tokens || 0, outputTokens: data.usage?.output_tokens || 0, action: "extract_olaclick" })).catch(() => {});
  return data.content?.[0]?.text || "";
}

function parseJSON(text: string): any {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in OlaClick extraction");
  let jsonStr = match[0];
  try { return JSON.parse(jsonStr); } catch {}
  jsonStr = jsonStr.replace(/,\s*\{[^}]*$/, "").replace(/,\s*"[^"]*"?\s*:?\s*[^,}\]]*$/, "").replace(/,\s*$/, "");
  let ob = 0, cb = 0; for (const ch of jsonStr) { if (ch === "[") ob++; if (ch === "]") cb++; }
  for (let i = 0; i < ob - cb; i++) jsonStr += "]";
  let oo = 0, co = 0; for (const ch of jsonStr) { if (ch === "{") oo++; if (ch === "}") co++; }
  for (let i = 0; i < oo - co; i++) jsonStr += "}";
  return JSON.parse(jsonStr);
}

export async function extractOlaClick(cartaUrl: string): Promise<ExtractionResult> {
  const productsUrl = resolveProductsUrl(cartaUrl);
  const origin = new URL(productsUrl).origin;
  console.log("[OlaClick] Starting extraction:", productsUrl);

  // Step 1: Fetch /products AND root HTML in parallel
  const [initialContent, rootHtml] = await Promise.all([
    fetchPage(productsUrl),
    fetchRootHtml(cartaUrl),
  ]);

  const logoUrl = extractLogoFromHtml(rootHtml);
  console.log("[OlaClick] Initial /products:", initialContent.length, "chars | Logo:", logoUrl ? "found" : "none");

  // Step 2: Discover category slugs from product links + root HTML + common slugs
  const slugsFromContent = extractCategorySlugs(initialContent, origin);
  const slugsFromHtml = extractSlugsFromNuxtHtml(rootHtml, origin);

  // Common category slugs used by Chilean/Latin restaurants on OlaClick
  const COMMON_SLUGS = [
    "promociones", "ofertas", "combos", "entradas", "tablas",
    "rolls", "rollos", "handrolls", "hand-rolls", "temakis", "sashimi", "nigiri",
    "gohan", "poke", "poke-bowls", "bowls", "especiales", "premium",
    "platos", "platos-de-fondo", "fondos", "carnes", "pescados", "mariscos",
    "pastas", "pizzas", "hamburguesas", "sandwiches", "ensaladas", "sopas",
    "postres", "bebidas", "jugos", "cervezas", "vinos", "tragos", "cocktails",
    "extras", "agregados", "complementos", "acompanamiento", "salsas",
    "menu-del-dia", "almuerzos", "desayunos", "brunch", "infantil",
    "vegetariano", "vegano", "sin-gluten", "wok", "gyoza", "dim-sum",
  ];

  const allSlugsSet = new Set([...slugsFromContent, ...slugsFromHtml, ...COMMON_SLUGS]);
  // Remove already-found first slug to avoid duplicating it
  const firstSlugFromContent = slugsFromContent[0];
  const categorySlugs = [...allSlugsSet];
  console.log("[OlaClick] Known slugs:", slugsFromContent.join(", ") || "none", "| Will probe", COMMON_SLUGS.length, "common slugs");

  // Step 3: Probe all candidate slugs via Jina in parallel batches
  // OlaClick returns the same SPA shell for any URL, so we need Jina to render JS
  // Use fast timeout since most slugs won't match
  const allContent: string[] = [initialContent];

  if (categorySlugs.length > 0) {
    const remainingSlugs = categorySlugs.filter(s => s !== firstSlugFromContent);

    const BATCH = 8; // Probe 8 at a time for speed
    for (let i = 0; i < remainingSlugs.length; i += BATCH) {
      const batch = remainingSlugs.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map(async (slug) => {
          try {
            const content = await fetchJina(`${origin}/${slug}`, { "X-Timeout": "15000", "X-No-Cache": "true" }, 20000);
            if (content.length > 300 && /\$\s*[\d.,]+/.test(content)) {
              console.log(`[OlaClick] /${slug}: ${content.length} chars ✓`);
              return content;
            }
          } catch {}
          return "";
        }),
      );
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) allContent.push(r.value);
      }
    }
    console.log(`[OlaClick] Found ${allContent.length - 1} additional category pages`);
  }

  const combinedContent = allContent.join("\n\n---\n\n");
  console.log("[OlaClick] Combined content:", combinedContent.length, "chars from", allContent.length, "pages");

  if (combinedContent.length < 300 || !/\$\s*[\d.,]+/.test(combinedContent)) {
    throw new Error("OlaClick: no se pudo obtener el contenido del menú con precios");
  }

  const trimmed = combinedContent.slice(0, 60000); // Higher limit since we have multi-page content

  // Step 4: Extract with Claude
  const result = await callClaude(`Analiza este menú digital de restaurante (plataforma OlaClick) y extrae toda la información.
Las secciones están separadas por "---". Cada sección es una categoría diferente del menú.
URL: ${cartaUrl}
Contenido renderizado:
${trimmed}

Responde SOLO con JSON:
{"restaurantName":"...","categories":[{"name":"...","dishes":[{"name":"...","description":"...","price":8990,"photo":"URL o null"}]}]}

REGLAS:
- Precios enteros sin puntos ni separadores: "$4.000"→4000, "$8.990"→8990, "$ 2.000"→2000
- Extrae TODOS los platos visibles con su precio
- Los platos están organizados en categorías: lee los encabezados (##) como categorías
- Los items se muestran como "[nombre] [descripción] [precio]" o como links con precio
- Extrae la descripción si está disponible
- Si un item no tiene precio, usa el precio que aparezca junto a su nombre
- NO omitas ninguna categoría ni plato
- SOLO JSON, sin texto adicional.`);

  console.log("[OlaClick] Claude response:", result.length, "chars");
  const parsed = parseJSON(result);

  const dishes: ExtractedDish[] = [];
  for (const cat of (parsed.categories || [])) {
    for (const dish of (cat.dishes || [])) {
      if (!dish.name) continue;
      const price = typeof dish.price === "number" ? dish.price : parseInt(String(dish.price).replace(/\D/g, ""), 10) || 0;
      dishes.push({
        name: dish.name.trim(),
        description: dish.description || "",
        price,
        imageUrl: dish.photo || null,
        category: cat.name || "General",
      });
    }
  }

  console.log("[OlaClick] Extracted", dishes.length, "dishes in", parsed.categories?.length || 0, "categories");

  if (dishes.length === 0) {
    throw new Error("OlaClick: no se extrajeron platos del menú");
  }

  return {
    restaurantName: parsed.restaurantName || "Restaurante",
    dishes,
    logoUrl,
    bannerUrl: null,
  };
}
