/**
 * Generic menu scraper using Jina AI + Claude.
 * Extracted from /agregarlocal/scrape for reuse in the funnel pipeline.
 * Works with any provider — Fudo, Mercat, Gourmedia, unknown sites.
 */

import type { ExtractionResult, ExtractedDish } from "./types";

// Read at call time, not import time, to ensure env is loaded
function getApiKey() { return process.env.ANTHROPIC_API_KEY; }
const MODEL_FAST = "claude-haiku-4-5-20251001"; // preview (~15s)
const MODEL_FULL = "claude-sonnet-4-6";          // full extraction (better quality)

// Domains where Jina is needed (heavy JS rendering / SPAs)
const JINA_FIRST_DOMAINS = ["fudo.com", "fudo.cl", "fu.do", "meitre.com", "toteat.app", "mer-cat.com", "kojo.cl", "mercat.cl", "ubereats.com", "sites.google.com", "influye.app", "socialreacts.com", "ola.click", "gour.media"];

// Domains where direct HTML works better
const DIRECT_FETCH_DOMAINS = ["thefork.com", "lafourchette.com"];

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

async function fetchWithTimeout(url: string, timeoutMs = 10000, extraHeaders?: Record<string, string>): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: "text/plain", "X-No-Cache": "true", ...extraHeaders } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally { clearTimeout(timer); }
}

async function fetchPage(url: string, forceJina = false): Promise<string> {
  const domain = getDomain(url);
  const preferDirect = !forceJina && DIRECT_FETCH_DOMAINS.some(d => domain.includes(d));
  const preferJina = forceJina || JINA_FIRST_DOMAINS.some(d => domain.includes(d));

  if (preferDirect) {
    try { const d = await fetchWithTimeout(url, 10000); if (d.length > 500) return d; } catch {}
    try { return await fetchWithTimeout(`https://r.jina.ai/${url}`, 12000); } catch {}
    return await fetchWithTimeout(url, 8000);
  }

  if (preferJina) {
    // For heavy SPAs (Vue/React), tell Jina to wait for content to render
    const spaHeaders = domain.includes("ola.click") ? { "X-Wait-For-Selector": ".products", "X-Timeout": "30000" } : undefined;
    try { return await fetchWithTimeout(`https://r.jina.ai/${url}`, spaHeaders ? 35000 : 12000, spaHeaders); } catch {}
    return await fetchWithTimeout(url, 8000);
  }

  // Unknown: try both, pick best
  let jinaContent = "", directContent = "";
  try { jinaContent = await fetchWithTimeout(`https://r.jina.ai/${url}`, 12000); } catch {}
  try { directContent = await fetchWithTimeout(url, 8000); } catch {}
  if (!jinaContent && !directContent) throw new Error("No se pudo acceder a la URL");

  // Detect SPAs that embed menu data in <script> tags (e.g. influye.app, other virtual menu platforms)
  // These need Jina to render the JS — direct HTML has the data hidden in scripts that get stripped
  if (directContent.includes("influye.app") || directContent.includes("var data = {") || directContent.includes("VIRTUAL_MENU")) {
    if (jinaContent.length > 500) return jinaContent;
  }

  const pricePattern = /\$[\d.,]+|\d{3,6}/g;
  const jinaPrices = (jinaContent.match(pricePattern) || []).length;
  const directPrices = (directContent.match(pricePattern) || []).length;
  if (directPrices > jinaPrices * 1.5 && directContent.length > 500) return directContent;
  return jinaContent || directContent;
}

/**
 * Discover a menu URL from a page that isn't itself a menu.
 * Looks for <a> tags whose text or href contain menu/carta keywords.
 * Returns the discovered URL or null.
 */
async function discoverMenuUrl(pageUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(pageUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; QuieroComer/1.0)" },
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return null;

    const reader = res.body?.getReader();
    if (!reader) return null;
    let html = "";
    const decoder = new TextDecoder();
    const MAX = 200_000;
    let bytes = 0;
    while (bytes < MAX) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      bytes += value.length;
    }
    reader.cancel();

    const base = new URL(pageUrl);

    // Pattern: <a ... href="URL" ...>text with menu/carta keywords</a>
    // Also match href itself containing carta/menu path segments
    const MENU_KEYWORDS = /carta|men[úu]|menu|ver.carta|ver.men[úu]/i;
    const linkRegex = /<a\s[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    const candidates: { url: string; score: number }[] = [];

    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1].trim();
      const text = match[2].replace(/<[^>]*>/g, "").trim().toLowerCase();

      // Skip empty, javascript:, mailto:, tel:, same-page anchors
      if (!href || href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;

      let score = 0;
      // Text contains menu/carta keywords
      if (MENU_KEYWORDS.test(text)) score += 3;
      // Href path contains menu/carta keywords
      if (MENU_KEYWORDS.test(href)) score += 2;
      // Bonus: text specifically says "ver carta" or "ver menú"
      if (/ver\s*(la\s+)?carta|ver\s*(el\s+)?men[úu]/i.test(text)) score += 3;

      if (score >= 2) {
        try {
          const resolved = new URL(href, base).toString();
          // Don't discover links to the same page
          if (resolved !== pageUrl && resolved !== pageUrl + "/") {
            candidates.push({ url: resolved, score });
          }
        } catch {}
      }
    }

    if (candidates.length === 0) return null;

    // Pick the highest-scoring candidate
    candidates.sort((a, b) => b.score - a.score);
    console.log(`[MenuDiscovery] Found ${candidates.length} menu link(s) on ${pageUrl}. Best: ${candidates[0].url} (score ${candidates[0].score})`);
    return candidates[0].url;
  } catch (err) {
    console.log("[MenuDiscovery] Failed to discover menu URL:", err);
    return null;
  }
}

/**
 * Extract dish name→photo mappings from JS/JSON data embedded in <script> tags.
 * Handles patterns like: { price: N, img: "URL", loc: { es: { name: "..." } } }
 * Used for platforms like Socialreacts/GHL that embed menu data in JS.
 */
function extractDishPhotosFromScript(html: string): { name: string; img: string }[] {
  const results: { name: string; img: string }[] = [];

  // Pattern 1: JSON objects with img + loc.es.name (socialreacts/GHL pattern)
  // Match: img:"URL" ... name:"dishName" within the same object context
  const itemRegex = /\{\s*(?:[^{}]*,)?\s*price\s*:\s*\d+\s*,\s*img\s*:\s*"([^"]+)"\s*,\s*loc\s*:\s*\{\s*es\s*:\s*\{\s*name\s*:\s*"([^"]+)"/g;
  let m;
  while ((m = itemRegex.exec(html)) !== null) {
    if (m[1] && m[2]) results.push({ img: m[1], name: m[2] });
  }
  if (results.length > 0) return results;

  // Pattern 2: Generic "img":"URL" near "name":"dishName" (within ~500 chars)
  const imgRegex = /["']img["']\s*:\s*["'](https?:\/\/[^"']+\.(?:webp|jpg|jpeg|png))["']/g;
  const nameRegex = /["']name["']\s*:\s*["']([^"']{3,80})["']/g;
  const imgs: { idx: number; url: string }[] = [];
  const names: { idx: number; name: string }[] = [];
  while ((m = imgRegex.exec(html)) !== null) imgs.push({ idx: m.index, url: m[1] });
  while ((m = nameRegex.exec(html)) !== null) names.push({ idx: m.index, name: m[1] });

  for (const img of imgs) {
    // Find closest name within 500 chars before the img
    const closest = names.filter(n => n.idx < img.idx && img.idx - n.idx < 500).pop();
    if (closest) results.push({ img: img.url, name: closest.name });
  }

  return results;
}

function cleanContent(html: string): string {
  const imgUrls: string[] = [];
  // Extract image URLs from <img> tags
  const imgMatches = html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi);
  for (const m of imgMatches) {
    const src = m[1];
    if (src && !src.includes("favicon") && !src.includes("logo") && !src.includes("icon") && !src.includes("data:image") && src.length > 10) {
      imgUrls.push(src);
    }
  }
  // Also extract image URLs from JSON/JS data inside <script> tags (e.g. socialreacts menus)
  // These are dish photos embedded as "img":"URL" in JS objects
  const scriptImgMatches = html.matchAll(/["']img["']\s*:\s*["'](https?:\/\/[^"']+\.(?:webp|jpg|jpeg|png))["']/gi);
  for (const m of scriptImgMatches) {
    if (m[1] && !imgUrls.includes(m[1])) imgUrls.push(m[1]);
  }

  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<[^>]*>\s*(\$[\d.,]+)\s*<\/[^>]*>/gi, " $1 ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/ {2,}/g, " ")
    .trim();

  if (imgUrls.length > 0) {
    cleaned += "\n\n[IMAGES FOUND ON PAGE]\n" + imgUrls.slice(0, 80).join("\n");
  }
  return cleaned;
}

async function callClaude(prompt: string, maxTokens = 32000, model = MODEL_FULL): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Claude error: ${res.status}`);
  const data = await res.json();
  import("@/lib/costTracker").then(m => m.logClaudeUsage({ model, inputTokens: data.usage?.input_tokens || 0, outputTokens: data.usage?.output_tokens || 0, action: "scrape_menu" })).catch(() => {});
  return data.content?.[0]?.text || "";
}

function parseJSON(text: string): any {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found");
  let jsonStr = match[0];
  try { return JSON.parse(jsonStr); } catch {}

  // Aggressive truncation repair:
  // 1. Remove trailing incomplete entries
  jsonStr = jsonStr
    .replace(/,\s*\{[^}]*$/, "")        // trailing incomplete object
    .replace(/,\s*"[^"]*"?\s*:?\s*[^,}\]]*$/, "") // trailing incomplete key-value
    .replace(/,\s*"[^"]*$/, "")          // trailing incomplete string
    .replace(/,\s*$/, "");               // trailing comma

  // 2. Close unclosed strings (find last unescaped quote)
  const quoteCount = (jsonStr.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 !== 0) jsonStr += '"';

  // 3. Balance brackets and braces
  let ob = 0, cb = 0; for (const ch of jsonStr) { if (ch === "[") ob++; if (ch === "]") cb++; }
  for (let i = 0; i < ob - cb; i++) jsonStr += "]";
  let oo = 0, co = 0; for (const ch of jsonStr) { if (ch === "{") oo++; if (ch === "}") co++; }
  for (let i = 0; i < oo - co; i++) jsonStr += "}";

  try { return JSON.parse(jsonStr); } catch {}

  // 4. Last resort: find the longest valid JSON prefix
  for (let end = jsonStr.length; end > 100; end--) {
    let attempt = jsonStr.slice(0, end);
    // Quick balance
    const bk = (attempt.match(/\[/g) || []).length - (attempt.match(/\]/g) || []).length;
    const br = (attempt.match(/\{/g) || []).length - (attempt.match(/\}/g) || []).length;
    for (let i = 0; i < bk; i++) attempt += "]";
    for (let i = 0; i < br; i++) attempt += "}";
    try { return JSON.parse(attempt); } catch {}
  }

  throw new Error("Could not repair truncated JSON from Claude");
}

/** Resolve the best URL for menu extraction based on provider */
function resolveMenuUrl(cartaUrl: string, providerName?: string | null): string {
  try {
    const url = new URL(cartaUrl);
    const path = url.pathname.replace(/\/$/, "");

    // Clean tracking params that can interfere with fetching
    for (const p of ["fbclid", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
      url.searchParams.delete(p);
    }

    // Justo: menu lives at /pedir
    if (providerName === "Justo" && !path.includes("/pedir")) {
      url.pathname = "/pedir";
      return url.toString();
    }

    return url.toString();
  } catch {}
  return cartaUrl;
}

function cleanName(name: string): string {
  return name.split("|")[0].split("-")[0].split("·")[0].split("—")[0].split("Pide")[0].split("Order")[0].trim();
}

/**
 * Quick preview: fetch page, send only first 4KB to Haiku for 5 dishes (~15s total).
 * Used for non-Justo providers where full extraction is too slow for preview.
 */
export async function extractQuickPreview(cartaUrl: string, providerName?: string | null): Promise<ExtractionResult> {
  const menuUrl = resolveMenuUrl(cartaUrl, providerName);
  const needsJina = ["Fudo", "Mercat", "Gourmedia", "UberEats", "Queresto"].includes(providerName || "");
  console.log("[QuickPreview] Fetching page:", menuUrl, needsJina ? "(Jina forced)" : "");
  const pageContent = await fetchPage(menuUrl, needsJina);
  console.log("[QuickPreview] Raw content:", pageContent.length, "chars");

  const isMarkdown = pageContent.startsWith("Title:") || pageContent.includes("Markdown Content:") || (pageContent.includes("URL Source:") && !pageContent.includes("<html"));
  const cleaned = isMarkdown ? pageContent : cleanContent(pageContent);
  const content = cleaned.slice(0, 4000);

  // Quick gastronomy check
  const lower = content.toLowerCase();
  const gastronomySignals = ["menú", "menu", "plato", "precio", "carta", "restauran", "comida", "cocina", "entrante", "postre", "bebida", "ensalada", "carne", "pollo", "pescado", "sushi", "pizza", "burger", "sandwich", "empanada", "ceviche", "parrilla", "asado", "grill", "café", "coffee", "appetizer", "dessert", "drink", "entree", "dish", "order", "delivery", "$",
    // SPA/JSON menu signals — virtual menus often have these keys
    '"price"', '"precio"', '"dishes"', '"platos"', '"category"', '"categoria"', '"products"', '"items"', "completo", "papas fritas", "hamburguesa", "lomito", "churrasco", "agregado", "acompañamiento", "salsa", "wrap", "nugget", "hot dog", "combo", "promo",
  ];
  let matchCount = gastronomySignals.filter(s => lower.includes(s)).length;
  // Boost: many price-like numbers (e.g. 2490, 7990) strongly suggest a menu
  const priceMatches = content.match(/\b\d{3,5}\b/g) || [];
  if (priceMatches.length >= 5) matchCount += 2;
  if (matchCount < 2) {
    const discoveredUrl = await discoverMenuUrl(menuUrl);
    if (discoveredUrl) {
      console.log(`[QuickPreview] Discovered menu URL: ${discoveredUrl} — retrying`);
      return extractQuickPreview(discoveredUrl, providerName);
    }
    throw new Error("El link no parece ser una carta de restaurante. Sube un link a tu menú o carta.");
  }

  console.log("[QuickPreview] Calling Haiku with", content.length, "chars...");
  const result = await callClaude(`Extrae los primeros 5 platos de este menú de restaurante con su categoría.
URL: ${cartaUrl}
Contenido:
${content}

Responde con JSON:
{"restaurantName":"...","logo":"URL o null","dishes":[{"name":"...","description":"...","price":8990,"photo":"URL o null","category":"..."}]}

REGLAS: Precios enteros ($8.990→8990). Máximo 5 platos. SOLO JSON.`, 2000, MODEL_FAST);

  console.log("[QuickPreview] Response:", result.length, "chars");
  const parsed = parseJSON(result);

  const dishes: ExtractedDish[] = [];
  for (const d of (parsed.dishes || [])) {
    if (!d.name || !d.price) continue;
    dishes.push({
      name: d.name.trim(),
      description: d.description || "",
      price: typeof d.price === "number" ? d.price : parseInt(String(d.price).replace(/\D/g, ""), 10) || 0,
      imageUrl: d.photo || null,
      category: d.category || "General",
    });
  }

  return {
    restaurantName: cleanName(parsed.restaurantName || "Restaurante"),
    dishes: dishes.slice(0, 5),
    logoUrl: parsed.logo || null,
    bannerUrl: null,
  };
}

/**
 * Generic scraper: fetches URL (with Jina for SPAs), sends to Claude for extraction.
 * Works with Fudo, Mercat, Gourmedia, and any unknown provider.
 */
export { discoverMenuUrl };

export async function extractWithScraper(cartaUrl: string, providerName?: string | null, extractionConfig?: any): Promise<ExtractionResult> {
  const menuUrl = resolveMenuUrl(cartaUrl, providerName);
  const baseUrl = new URL(menuUrl).origin;
  const cfgUseJina = extractionConfig?.useJina === true;
  const cfgMaxChars = extractionConfig?.maxContentChars || 40000;
  const needsJina = cfgUseJina || ["Fudo", "Mercat", "Gourmedia", "UberEats", "Queresto"].includes(providerName || "");

  console.log("[Scraper] Fetching page:", menuUrl, needsJina ? "(Jina forced)" : "", extractionConfig ? `(config: ${JSON.stringify(extractionConfig)})` : "");

  // Gourmedia: multi-page menus — fetch all food sub-pages and combine
  if (getDomain(menuUrl).includes("gour.media")) {
    console.log("[Scraper] Gourmedia detected — fetching sub-pages...");
    try {
      const mainPage = await fetchPage(menuUrl, true);
      // Extract sub-page links for this restaurant
      const slug = menuUrl.replace(/https?:\/\/gour\.media\//, "").replace(/\/$/, "");
      const subPageRegex = new RegExp(`gour\\.media/${slug}/([a-z0-9-]+)/?`, "gi");
      const subMatches = mainPage.match(subPageRegex) || [];
      const subSlugs = [...new Set(subMatches.map(m => m.replace(`gour.media/${slug}/`, "").replace(/\/$/, "")))];
      // Filter food-related sub-pages (skip bar, vinos, reservas, etc.)
      const drinkPages = new Set(["bar", "barra", "carta-de-vinos", "vinos", "vinos-y-espumantes", "cocteles", "cocktails", "tragos", "cervezas", "bebidas", "reservas", "reservar"]);
      const foodPages = subSlugs.filter(s => !drinkPages.has(s) && s.length > 1);
      console.log(`[Scraper] Gourmedia sub-pages: ${subSlugs.join(", ")} → food: ${foodPages.join(", ")}`);

      if (foodPages.length > 0) {
        let combined = mainPage;
        for (const sub of foodPages) {
          const subUrl = `https://gour.media/${slug}/${sub}/`;
          console.log(`[Scraper] Fetching Gourmedia sub-page: ${subUrl}`);
          try {
            const subContent = await fetchPage(subUrl, true);
            combined += `\n\n--- SECCIÓN: ${sub.toUpperCase().replace(/-/g, " ")} ---\n\n` + subContent;
          } catch (e) { console.log(`[Scraper] Sub-page failed: ${sub}`); }
          await new Promise(r => setTimeout(r, 1000));
        }
        // Continue with combined content
        const pageContent = combined;
        const isMarkdown = true;
        let cleaned = pageContent;
        console.log("[Scraper] Gourmedia combined length:", cleaned.length);
        const content = cleaned.length > cfgMaxChars * 2 ? cleaned.slice(0, cfgMaxChars * 2) : cleaned;
        console.log("[Scraper] Trimmed to:", content.length, "| Calling Claude...");

        const gourResult = await callClaude(`Analiza esta página de menú de restaurante y extrae toda la información.
URL: ${menuUrl}
Contenido:
${content}

Responde con JSON:
{"restaurantName":"...","logo":"URL o null","categories":[{"name":"...","dishes":[{"name":"...","description":"...","price":8990,"photo":"URL o null","diet":"OMNIVORE"|"VEGAN"|"VEGETARIAN","isSpicy":false}]}]}

REGLAS IMPORTANTES:
- Precios: busca números que parezcan precios. Conviértelos a enteros sin puntos: $8.990→8990
- Fotos: busca URLs de imágenes y asócialas al plato correspondiente
- Las URLs de fotos deben ser absolutas
- NO incluyas bebidas, tragos, vinos, cervezas ni bebestibles
- diet: "VEGAN" si vegano, "VEGETARIAN" si vegetariano, "OMNIVORE" si no
- SOLO JSON, sin texto adicional.`);

        const gourParsed = parseJSON(gourResult);
        const gourDishes: ExtractedDish[] = [];
        for (const cat of (gourParsed.categories || [])) {
          for (const dish of (cat.dishes || [])) {
            if (!dish.name) continue;
            gourDishes.push({
              name: dish.name.trim(),
              description: dish.description || "",
              price: typeof dish.price === "number" ? dish.price : parseInt(String(dish.price).replace(/\D/g, ""), 10) || 0,
              imageUrl: dish.photo || null,
              category: cat.name || "General",
              diet: ["VEGAN", "VEGETARIAN"].includes(dish.diet) ? dish.diet : "OMNIVORE",
              isSpicy: dish.isSpicy || false,
            });
          }
        }
        console.log(`[Scraper] Gourmedia extracted ${gourDishes.length} dishes`);
        return {
          restaurantName: cleanName(gourParsed.restaurantName || "Restaurante"),
          dishes: gourDishes,
          logoUrl: gourParsed.logo || null,
          bannerUrl: null,
        };
      }
    } catch (e) { console.log("[Scraper] Gourmedia multi-page failed, falling back to single page"); }
  }

  const pageContent = await fetchPage(menuUrl, needsJina);
  console.log("[Scraper] Raw content length:", pageContent.length);
  // If content looks like markdown (from Jina), skip HTML cleaning
  const isMarkdown = pageContent.startsWith("Title:") || pageContent.includes("Markdown Content:") || (pageContent.includes("URL Source:") && !pageContent.includes("<html"));
  let cleaned = isMarkdown ? pageContent : cleanContent(pageContent);

  // When Jina was used (markdown), also fetch raw HTML to extract dish photo URLs
  // that are embedded in JS/JSON data (e.g. socialreacts menuData)
  if (isMarkdown) {
    try {
      const rawHtml = await fetchWithTimeout(menuUrl, 8000).catch(() => "");
      if (rawHtml.length > 500) {
        const photoMap = extractDishPhotosFromScript(rawHtml);
        if (photoMap.length > 0) {
          cleaned += "\n\n[DISH PHOTOS FROM PAGE DATA]\n" + photoMap.map(p => `${p.name}: ${p.img}`).join("\n");
          console.log(`[Scraper] Extracted ${photoMap.length} dish photos from raw HTML`);
        }
      }
    } catch {}
  }

  console.log("[Scraper] Cleaned length:", cleaned.length, isMarkdown ? "(markdown, no cleaning)" : "(HTML cleaned)");
  const content = cleaned.length > cfgMaxChars ? cleaned.slice(0, cfgMaxChars) : cleaned;
  console.log("[Scraper] Trimmed to:", content.length, `(max: ${cfgMaxChars})`, "| Calling Claude...");

  // Quick gastronomy check — reject pages that clearly aren't restaurant menus
  const lower = content.toLowerCase();
  const gastronomySignals = ["menú", "menu", "plato", "precio", "carta", "restauran", "comida", "cocina", "entrante", "postre", "bebida", "ensalada", "carne", "pollo", "pescado", "sushi", "pizza", "burger", "sandwich", "empanada", "ceviche", "parrilla", "asado", "grill", "café", "coffee", "appetizer", "dessert", "drink", "entree", "dish", "order", "delivery", "$",
    // SPA/JSON menu signals — virtual menus often have these keys
    '"price"', '"precio"', '"dishes"', '"platos"', '"category"', '"categoria"', '"products"', '"items"', "completo", "papas fritas", "hamburguesa", "lomito", "churrasco", "agregado", "acompañamiento", "salsa", "wrap", "nugget", "hot dog", "combo", "promo",
  ];
  let matchCount = gastronomySignals.filter(s => lower.includes(s)).length;
  // Boost: many price-like numbers (e.g. 2490, 7990) strongly suggest a menu
  const priceMatches = content.match(/\b\d{3,5}\b/g) || [];
  if (priceMatches.length >= 5) matchCount += 2;
  if (matchCount < 2) {
    // If cleaned HTML lost menu data (SPA/JS-rendered menus), check raw HTML for signals
    if (!isMarkdown && pageContent.length > 10000) {
      const rawLower = pageContent.toLowerCase();
      const rawSignals = gastronomySignals.filter(s => rawLower.includes(s)).length;
      const rawPrices = (pageContent.match(/"price"\s*:\s*\d|price:\s*\d|\bprecio\b/gi) || []).length;
      if (rawSignals >= 3 || rawPrices >= 3) {
        console.log(`[Scraper] Cleaned HTML lost menu data (${matchCount} signals) but raw HTML has ${rawSignals} signals + ${rawPrices} price refs. Extracting from scripts.`);
        // Extract complete product objects (influye.app: "title":"...","description":"...","image":"...","price":N)
        const productRegex = /"(?:title|name)":"([^"]+)","description":"([^"]*)","(?:image|img)":"([^"]*)","price":(\d+)/g;
        const products: { name: string; desc: string; img: string; price: number }[] = [];
        let pm;
        while ((pm = productRegex.exec(pageContent)) !== null) {
          if (pm[4] && parseInt(pm[4]) > 0) {
            products.push({ name: pm[1], desc: pm[2], img: pm[3], price: parseInt(pm[4]) });
          }
        }
        if (products.length > 3) {
          cleaned = `[MENU DATA FROM EMBEDDED SCRIPTS - ${products.length} products]\n` +
            products.map(p => `- ${p.name}: $${p.price}${p.desc ? ` (${p.desc})` : ""}${p.img ? ` [img: ${p.img}]` : ""}`).join("\n");
          console.log(`[Scraper] Extracted ${products.length} products from script data`);
          matchCount = 10;
        } else {
          // Fallback: extract raw key-value pairs for Claude
          const menuData = pageContent.match(/"(?:title|name)"\s*:\s*"[^"]+"|"price"\s*:\s*\d+|"description"\s*:\s*"[^"]*"/g) || [];
          if (menuData.length > 5) {
            cleaned = `[MENU DATA FROM PAGE SCRIPTS]\n${menuData.slice(0, 500).join("\n")}`;
            matchCount = 10;
          }
        }
      }
    }
    if (matchCount < 2) {
      // Try discovering a menu link on the page (but don't recurse if already a discovery attempt)
      if (!extractionConfig?._discoveryAttempt) {
        console.log(`[Scraper] Content doesn't look like a restaurant menu (${matchCount} signals). Trying menu discovery...`);
        const discoveredUrl = await discoverMenuUrl(menuUrl);
        if (discoveredUrl) {
          console.log(`[Scraper] Discovered menu URL: ${discoveredUrl} — retrying extraction`);
          return extractWithScraper(discoveredUrl, providerName, { ...extractionConfig, _discoveryAttempt: true });
        }
      }
      console.log(`[Scraper] Content doesn't look like a restaurant menu (${matchCount} signals). Rejecting.`);
      throw new Error("El link no parece ser una carta de restaurante. Sube un link a tu menú o carta.");
    }
  }

  // Recalculate content after potential script data extraction above
  const finalContent = cleaned.length > cfgMaxChars ? cleaned.slice(0, cfgMaxChars) : cleaned;

  // Detect if source is a PDF (text may be scrambled/unordered)
  const isPdf = /\.pdf(\?|$)/i.test(cartaUrl) || finalContent.includes("Number of Pages:");
  const pdfHint = isPdf ? `
IMPORTANTE — TEXTO DE PDF: El contenido viene de un PDF con formato visual. Los nombres de platos y precios pueden estar SEPARADOS o DESORDENADOS en el texto. Debes reconstruir la carta asociando cada plato con su precio correcto por contexto y proximidad. No te rindas si el texto parece confuso — analiza todo el contenido completo y extrae todos los platos que puedas encontrar.` : "";

  const result = await callClaude(`Analiza esta página de menú de restaurante y extrae toda la información.
URL: ${cartaUrl}
Contenido:
${finalContent}

Responde con JSON:
{"restaurantName":"...","logo":"URL o null","categories":[{"name":"...","dishes":[{"name":"...","description":"...","price":8990,"photo":"URL o null","diet":"OMNIVORE"|"VEGAN"|"VEGETARIAN","isSpicy":false}]}]}

REGLAS IMPORTANTES:
- Precios: busca números que parezcan precios (ej: $8.990, 8990, $12.500). Conviértelos a enteros sin puntos: $8.990→8990
- Si un precio tiene formato "8.990" (con punto de miles), es 8990 no 8.99
- Fotos: busca URLs de imágenes en [IMAGES FOUND ON PAGE] o [DISH PHOTOS FROM PAGE DATA] y asócialas al plato correspondiente por nombre o posición
- Las URLs de fotos deben ser absolutas. Si son relativas, añade ${baseUrl} al inicio
- NO dejes price en 0 si hay un precio visible en la página
- diet: "VEGAN" si tiene marcas veganas (🌿/V/vegan), "VEGETARIAN" si vegetariano, "OMNIVORE" si no hay indicador
- isSpicy: true si tiene marcas de picante (🌶️/spicy/picante)
- SOLO JSON, sin texto adicional.${pdfHint}`);

  console.log("[Scraper] Claude response length:", result.length);
  const parsed = parseJSON(result);
  console.log("[Scraper] Parsed categories:", parsed.categories?.length || 0);

  const dishes: ExtractedDish[] = [];
  for (const cat of (parsed.categories || [])) {
    for (const dish of (cat.dishes || [])) {
      if (!dish.name) continue;
      dishes.push({
        name: dish.name.trim(),
        description: dish.description || "",
        price: typeof dish.price === "number" ? dish.price : parseInt(String(dish.price).replace(/\D/g, ""), 10) || 0,
        imageUrl: dish.photo || null,
        category: cat.name || "General",
        diet: ["VEGAN", "VEGETARIAN"].includes(dish.diet) ? dish.diet : "OMNIVORE",
        isSpicy: dish.isSpicy || false,
      });
    }
  }

  return {
    restaurantName: cleanName(parsed.restaurantName || "Restaurante"),
    dishes,
    logoUrl: parsed.logo || null,
    bannerUrl: null,
  };
}
