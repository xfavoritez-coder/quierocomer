/**
 * Generic menu scraper using Jina AI + Claude.
 * Extracted from /agregarlocal/scrape for reuse in the funnel pipeline.
 * Works with any provider — Fudo, Mercat, Gourmedia, unknown sites.
 */

import type { ExtractionResult, ExtractedDish } from "./types";

// Read at call time, not import time, to ensure env is loaded
function getApiKey() { return process.env.ANTHROPIC_API_KEY; }
const MODEL = "claude-sonnet-4-6";

// Domains where Jina is needed (heavy JS rendering / SPAs)
const JINA_FIRST_DOMAINS = ["fudo.com", "fudo.cl", "fu.do", "meitre.com", "toteat.app", "mer-cat.com", "kojo.cl", "mercat.cl"];

// Domains where direct HTML works better
const DIRECT_FETCH_DOMAINS = ["queresto.com", "thefork.com", "lafourchette.com"];

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

async function fetchWithTimeout(url: string, timeoutMs = 10000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: "text/plain", "X-No-Cache": "true" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally { clearTimeout(timer); }
}

async function fetchPage(url: string): Promise<string> {
  const domain = getDomain(url);
  const preferDirect = DIRECT_FETCH_DOMAINS.some(d => domain.includes(d));
  const preferJina = JINA_FIRST_DOMAINS.some(d => domain.includes(d));

  if (preferDirect) {
    try { const d = await fetchWithTimeout(url, 10000); if (d.length > 500) return d; } catch {}
    try { return await fetchWithTimeout(`https://r.jina.ai/${url}`, 12000); } catch {}
    return await fetchWithTimeout(url, 8000);
  }

  if (preferJina) {
    try { return await fetchWithTimeout(`https://r.jina.ai/${url}`, 12000); } catch {}
    return await fetchWithTimeout(url, 8000);
  }

  // Unknown: try both, pick best
  let jinaContent = "", directContent = "";
  try { jinaContent = await fetchWithTimeout(`https://r.jina.ai/${url}`, 12000); } catch {}
  try { directContent = await fetchWithTimeout(url, 8000); } catch {}
  if (!jinaContent && !directContent) throw new Error("No se pudo acceder a la URL");

  const pricePattern = /\$[\d.,]+|\d{3,6}/g;
  const jinaPrices = (jinaContent.match(pricePattern) || []).length;
  const directPrices = (directContent.match(pricePattern) || []).length;
  if (directPrices > jinaPrices * 1.5 && directContent.length > 500) return directContent;
  return jinaContent || directContent;
}

function cleanContent(html: string): string {
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
    .replace(/<[^>]*>\s*(\$[\d.,]+)\s*<\/[^>]*>/gi, " $1 ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/ {2,}/g, " ")
    .trim();

  if (imgUrls.length > 0) {
    cleaned += "\n\n[IMAGES FOUND ON PAGE]\n" + imgUrls.slice(0, 80).join("\n");
  }
  return cleaned;
}

async function callClaude(prompt: string, maxTokens = 16000): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
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

function cleanName(name: string): string {
  return name.split("|")[0].split("-")[0].split("·")[0].split("—")[0].split("Pide")[0].split("Order")[0].trim();
}

/**
 * Generic scraper: fetches URL (with Jina for SPAs), sends to Claude for extraction.
 * Works with Fudo, Mercat, Gourmedia, and any unknown provider.
 */
export async function extractWithScraper(cartaUrl: string): Promise<ExtractionResult> {
  const baseUrl = new URL(cartaUrl).origin;

  console.log("[Scraper] Fetching page:", cartaUrl);
  const pageContent = await fetchPage(cartaUrl);
  console.log("[Scraper] Raw content length:", pageContent.length);
  // If content looks like markdown (from Jina), skip HTML cleaning
  const isMarkdown = pageContent.startsWith("Title:") || pageContent.includes("Markdown Content:") || (pageContent.includes("URL Source:") && !pageContent.includes("<html"));
  const cleaned = isMarkdown ? pageContent : cleanContent(pageContent);
  console.log("[Scraper] Cleaned length:", cleaned.length, isMarkdown ? "(markdown, no cleaning)" : "(HTML cleaned)");
  const content = cleaned.length > 20000 ? cleaned.slice(0, 20000) : cleaned;
  console.log("[Scraper] Trimmed to:", content.length, "| Calling Claude...");

  const result = await callClaude(`Analiza esta página de menú de restaurante y extrae toda la información.
URL: ${cartaUrl}
Contenido:
${content}

Responde con JSON:
{"restaurantName":"...","logo":"URL o null","categories":[{"name":"...","dishes":[{"name":"...","description":"...","price":8990,"photo":"URL o null"}]}]}

REGLAS IMPORTANTES:
- Precios: busca números que parezcan precios (ej: $8.990, 8990, $12.500). Conviértelos a enteros sin puntos: $8.990→8990
- Si un precio tiene formato "8.990" (con punto de miles), es 8990 no 8.99
- Fotos: busca URLs de imágenes en la sección [IMAGES FOUND ON PAGE] y asócialas al plato correspondiente por nombre o posición
- Las URLs de fotos deben ser absolutas. Si son relativas, añade ${baseUrl} al inicio
- NO dejes price en 0 si hay un precio visible en la página
- SOLO JSON, sin texto adicional.`);

  console.log("[Scraper] Claude response length:", result.length);
  const parsed = parseJSON(result);
  console.log("[Scraper] Parsed categories:", parsed.categories?.length || 0);

  const dishes: ExtractedDish[] = [];
  for (const cat of (parsed.categories || [])) {
    for (const dish of (cat.dishes || [])) {
      if (!dish.name || !dish.price) continue;
      dishes.push({
        name: dish.name.trim(),
        description: dish.description || "",
        price: typeof dish.price === "number" ? dish.price : parseInt(String(dish.price).replace(/\D/g, ""), 10) || 0,
        imageUrl: dish.photo || null,
        category: cat.name || "General",
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
