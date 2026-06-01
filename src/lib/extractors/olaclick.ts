/**
 * OlaClick extractor.
 * OlaClick is a Vue.js/Nuxt SPA — products load dynamically via JS.
 * Strategy: try Jina with multiple configs, pick best content, extract with Claude directly.
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

/** Try to extract logo from the root page NUXT data */
async function extractLogo(cartaUrl: string): Promise<string | null> {
  try {
    const rootUrl = new URL(cartaUrl).origin;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(rootUrl, { signal: controller.signal });
    clearTimeout(timer);
    const html = await res.text();
    const logoMatch = html.match(/logo_url\s*:\s*"([^"]+)"/);
    if (logoMatch) return logoMatch[1].replace(/\\u002F/g, "/");
    const logoMatch2 = html.match(/logo_thumbnail_url\s*:\s*"([^"]+)"/);
    if (logoMatch2) return logoMatch2[1].replace(/\\u002F/g, "/");
  } catch {}
  return null;
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

/** Fetch with Jina, trying multiple configurations, return the best content */
async function fetchBestContent(url: string): Promise<string> {
  const attempts: { headers: Record<string, string>; label: string }[] = [
    { headers: { "X-Wait-For-Selector": ".infinite-products", "X-Timeout": "30000", "X-No-Cache": "true" }, label: "wait-infinite" },
    { headers: { "X-Timeout": "30000", "X-No-Cache": "true" }, label: "no-wait" },
    { headers: { "X-Wait-For-Selector": ".products", "X-Timeout": "40000" }, label: "wait-products" },
  ];

  let best = "";
  for (const { headers, label } of attempts) {
    try {
      const text = await fetchJina(url, headers);
      const hasPrices = /\$\s*[\d.,]+/.test(text);
      console.log(`[OlaClick] Jina ${label}: ${text.length} chars, prices: ${hasPrices}`);
      if (text.length > best.length && hasPrices) best = text;
      if (best.length > 2000) break; // Good enough
    } catch (e: any) {
      console.log(`[OlaClick] Jina ${label} failed: ${e.message}`);
    }
  }
  return best;
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
  console.log("[OlaClick] Starting extraction:", productsUrl);

  const [content, logoUrl] = await Promise.all([
    fetchBestContent(productsUrl),
    extractLogo(cartaUrl),
  ]);

  console.log("[OlaClick] Best content:", content.length, "chars | Logo:", logoUrl ? "found" : "none");

  if (content.length < 300 || !/\$\s*[\d.,]+/.test(content)) {
    throw new Error("OlaClick: no se pudo obtener el contenido del menú con precios");
  }

  const trimmed = content.slice(0, 40000);

  const result = await callClaude(`Analiza este menú digital de restaurante (plataforma OlaClick) y extrae toda la información.
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
