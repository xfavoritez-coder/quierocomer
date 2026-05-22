/**
 * Canva design extractor.
 * Canva renders designs as images — scrapers can't read the content.
 * Strategy: use Jina to get a readable version, or fall back to screenshot + Claude Vision.
 */
import type { ExtractionResult, ExtractedDish } from "./types";

export async function extractCanva(cartaUrl: string): Promise<ExtractionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  // Clean Canva URL: remove tracking params, ensure /view path
  const cleanUrl = cleanCanvaUrl(cartaUrl);
  console.log("[Canva] Extracting from:", cleanUrl);

  // Try Jina first — Canva public view pages sometimes render readable text
  let content = "";
  try {
    const jinaRes = await fetch(`https://r.jina.ai/${cleanUrl}`, {
      signal: AbortSignal.timeout(15000),
      headers: { Accept: "text/plain", "X-No-Cache": "true" },
    });
    if (jinaRes.ok) content = await jinaRes.text();
    console.log("[Canva] Jina content:", content.length, "chars");
  } catch {
    console.log("[Canva] Jina failed, will try screenshot");
  }

  // Extract image URLs from Jina markdown (Canva renders pages as images)
  const imageUrls = [...content.matchAll(/!\[.*?\]\((https:\/\/media\.canva\.com\/[^\)]+)\)/g)].map(m => m[1]);
  console.log("[Canva] Found", imageUrls.length, "Canva page images");

  // Check if Jina got meaningful text content (prices)
  const pricePattern = /\$[\d.,]+|\d{3,6}/g;
  const prices = (content.match(pricePattern) || []).length;

  if (content.length > 500 && prices >= 3) {
    console.log("[Canva] Jina got", prices, "prices, using text extraction");
    return extractFromText(content.slice(0, 40000), apiKey, cleanUrl);
  }

  // Use Canva page images with Claude Vision (most reliable)
  if (imageUrls.length > 0) {
    console.log("[Canva] Using Canva page images + Vision");
    return extractFromCanvaImages(imageUrls.slice(0, 8), apiKey);
  }

  // Last fallback: screenshot
  console.log("[Canva] No images found, trying screenshot");
  return extractFromScreenshot(cleanUrl, apiKey);
}

function cleanCanvaUrl(url: string): string {
  try {
    const u = new URL(url);
    // Remove tracking params
    ["utm_content", "utm_campaign", "utm_medium", "utm_source", "fbclid"].forEach(p => u.searchParams.delete(p));
    return u.toString();
  } catch {
    return url;
  }
}

async function extractFromText(content: string, apiKey: string, url: string): Promise<ExtractionResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      messages: [{ role: "user", content: `Analiza este contenido de una carta/menú de restaurante (extraído de un diseño de Canva).
URL: ${url}
Contenido:
${content}

Responde con JSON:
{"restaurantName":"...","categories":[{"name":"...","dishes":[{"name":"...","description":"...","price":8990,"diet":"OMNIVORE"|"VEGAN"|"VEGETARIAN","isSpicy":false}]}]}

REGLAS: Precios enteros sin puntos ($8.990→8990). NO inventes platos. SOLO JSON.` }],
    }),
  });

  if (!res.ok) throw new Error(`Claude error: ${res.status}`);
  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  return parseClaudeResponse(text);
}

async function extractFromCanvaImages(imageUrls: string[], apiKey: string): Promise<ExtractionResult> {
  // Download and encode images
  const images: { type: "image"; source: { type: "base64"; media_type: string; data: string } }[] = [];
  for (const url of imageUrls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) continue;
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length < 500) continue;
      const contentType = res.headers.get("content-type") || "image/png";
      const mediaType = contentType.includes("jpeg") || contentType.includes("jpg") ? "image/jpeg" : "image/png";
      images.push({ type: "image", source: { type: "base64", media_type: mediaType, data: buffer.toString("base64") } });
      console.log(`[Canva] Downloaded image ${images.length}: ${(buffer.length / 1024).toFixed(0)}KB`);
    } catch {
      console.log(`[Canva] Failed to download image: ${url.slice(0, 80)}`);
    }
  }

  if (images.length === 0) throw new Error("No Canva images could be downloaded");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      messages: [{
        role: "user",
        content: [
          ...images,
          { type: "text", text: `Estas ${images.length} imágenes son páginas de una carta/menú de restaurante diseñada en Canva.
Extrae TODOS los platos visibles con sus precios y categorías.
IMPORTANTE: Solo extrae lo que puedas leer claramente. NO inventes platos.
Responde SOLO con JSON:
{"restaurantName":"...","categories":[{"name":"...","dishes":[{"name":"...","description":"...","price":8990,"diet":"OMNIVORE"|"VEGAN"|"VEGETARIAN","isSpicy":false}]}]}
Precios enteros sin puntos ($8.990→8990). SOLO JSON.` },
        ],
      }],
    }),
  });

  if (!res.ok) throw new Error(`Claude Vision error: ${res.status}`);
  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  return parseClaudeResponse(text);
}

async function extractFromScreenshot(url: string, apiKey: string): Promise<ExtractionResult> {
  // Use Jina's screenshot endpoint
  const screenshotUrl = `https://s.jina.ai/${encodeURIComponent(url)}`;

  let imageBuffer: Buffer;
  try {
    const res = await fetch(screenshotUrl, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`Screenshot failed: ${res.status}`);
    imageBuffer = Buffer.from(await res.arrayBuffer());
    console.log("[Canva] Screenshot size:", imageBuffer.length, "bytes");
  } catch (e) {
    // Fallback: try direct fetch of Canva thumbnail
    console.log("[Canva] Screenshot failed, trying direct URL as image");
    const directRes = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!directRes.ok) throw new Error("Cannot capture Canva design");
    imageBuffer = Buffer.from(await directRes.arrayBuffer());
  }

  if (imageBuffer.length < 1000) throw new Error("Screenshot too small");

  const base64 = imageBuffer.toString("base64");
  const mediaType = "image/jpeg";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: `Esta imagen es una carta/menú de restaurante (diseñada en Canva).
Extrae TODOS los platos visibles con sus precios y categorías.
IMPORTANTE: Solo extrae lo que puedas leer claramente. NO inventes platos.
Responde SOLO con JSON:
{"restaurantName":"...","categories":[{"name":"...","dishes":[{"name":"...","description":"...","price":8990,"diet":"OMNIVORE"|"VEGAN"|"VEGETARIAN","isSpicy":false}]}]}
Precios enteros sin puntos ($8.990→8990). SOLO JSON.` },
        ],
      }],
    }),
  });

  if (!res.ok) throw new Error(`Claude Vision error: ${res.status}`);
  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  return parseClaudeResponse(text);
}

function parseClaudeResponse(text: string): ExtractionResult {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in Claude response");

  let parsed: any;
  try { parsed = JSON.parse(match[0]); } catch {
    let jsonStr = match[0].replace(/,\s*\{[^}]*$/, "").replace(/,\s*$/, "");
    let o = 0, c = 0; for (const ch of jsonStr) { if (ch === "[") o++; if (ch === "]") c++; }
    for (let i = 0; i < o - c; i++) jsonStr += "]";
    let oo = 0, cc = 0; for (const ch of jsonStr) { if (ch === "{") oo++; if (ch === "}") cc++; }
    for (let i = 0; i < oo - cc; i++) jsonStr += "}";
    parsed = JSON.parse(jsonStr);
  }

  const dishes: ExtractedDish[] = [];
  for (const cat of (parsed.categories || [])) {
    for (const dish of (cat.dishes || [])) {
      if (!dish.name) continue;
      dishes.push({
        name: dish.name.trim(),
        description: dish.description || "",
        price: typeof dish.price === "number" ? dish.price : parseInt(String(dish.price).replace(/\D/g, ""), 10) || 0,
        imageUrl: null,
        category: cat.name || "General",
        diet: ["VEGAN", "VEGETARIAN"].includes(dish.diet) ? dish.diet : "OMNIVORE",
        isSpicy: dish.isSpicy || false,
      });
    }
  }

  return {
    restaurantName: parsed.restaurantName || "Restaurante",
    dishes,
    logoUrl: null,
    bannerUrl: null,
  };
}
