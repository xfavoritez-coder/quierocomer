/**
 * Toteat extractor — estrategia multi-paso para menús públicos de QR.
 *
 * URL pública: https://toteat.app/r/{country}/{slug}/{branchId}/checkin/menu
 *
 * Estrategia:
 * 1. Extraer branchId y slug de la URL
 * 2. Intentar API pública de Toteat con el branchId (sin credenciales)
 * 3. Si falla, obtener Firebase config del HTML y consultar Firestore REST API
 * 4. Fallback: Jina rendering + Claude para parsear el HTML renderizado
 */

import type { ExtractionResult, ExtractedDish } from "./types";

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

/** Parse Toteat public URL → { country, slug, branchId } */
function parseToteatUrl(url: string): { country: string; slug: string; branchId: string } | null {
  // https://toteat.app/r/cl/Sushinikkei17/4932/checkin/menu
  // https://toteat.app/r/cl/Sushinikkei17/4932/checkin/menu/
  const m = url.match(/toteat\.app\/r\/([a-z]+)\/([^/]+)\/(\d+)/i);
  if (!m) return null;
  return { country: m[1], slug: m[2], branchId: m[3] };
}

/**
 * Intenta los endpoints conocidos de la API pública de Toteat.
 * Toteat expone /products para clientes del POS (con credenciales),
 * pero también puede tener endpoints públicos para el QR de carta.
 */
async function tryToteatPublicApi(branchId: string, slug: string): Promise<ExtractedDish[] | null> {
  const BASES = [
    `https://app.toteat.com/r/api/public/v1`,
    `https://api.toteat.com/public/v1`,
    `https://api.toteat.com/v1/public`,
  ];

  const PATHS = [
    `/menu?xil=${branchId}`,
    `/menu/${branchId}`,
    `/products?xil=${branchId}`,
    `/branches/${branchId}/menu`,
    `/branches/${branchId}/products`,
    `/checkin/${branchId}/menu`,
  ];

  // Probe all endpoints in parallel — 18 sequential calls × 6s = 108s → now ~4s total
  const tryOne = async (url: string): Promise<ExtractedDish[] | null> => {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) return null;
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("json")) return null;
      const data = await res.json();
      const dishes = parseApiResponse(data);
      return dishes.length >= 3 ? dishes : null;
    } catch { return null; }
  };

  const urls = BASES.flatMap(base => PATHS.map(path => base + path));
  const results = await Promise.all(urls.map(tryOne));
  const found = results.find(r => r !== null) ?? null;
  if (found) console.log(`[Toteat] Public API success: ${found.length} dishes`);
  return found;
}

/** Parse diferentes estructuras de respuesta de la API Toteat */
function parseApiResponse(data: any): ExtractedDish[] {
  const dishes: ExtractedDish[] = [];

  // Estructura: { ok: true, data: [ { name, price, category, ... } ] }
  const items: any[] = [];
  if (Array.isArray(data?.data)) items.push(...data.data);
  else if (Array.isArray(data?.products)) items.push(...data.products);
  else if (Array.isArray(data?.items)) items.push(...data.items);
  else if (Array.isArray(data?.menu)) items.push(...data.menu);
  else if (Array.isArray(data)) items.push(...data);

  // Estructura con categorías: { categories: [ { name, products: [...] } ] }
  if (items.length === 0 && Array.isArray(data?.categories)) {
    for (const cat of data.categories) {
      const products = cat.products || cat.dishes || cat.items || [];
      for (const p of products) {
        if (p.name || p.nombre) {
          dishes.push({
            name: (p.name || p.nombre || "").trim(),
            description: p.description || p.descripcion || "",
            price: parsePrice(p.price ?? p.precio ?? p.netPrice ?? 0),
            imageUrl: p.image || p.imageUrl || p.img || p.photo || null,
            category: cat.name || cat.nombre || "General",
          });
        }
      }
    }
    return dishes;
  }

  for (const item of items) {
    if (!item.name && !item.nombre) continue;
    // Skip modifiers / add-ons
    if (item.isModifier || item.modifier) continue;

    dishes.push({
      name: (item.name || item.nombre || "").trim(),
      description: item.description || item.descripcion || "",
      price: parsePrice(item.price ?? item.precio ?? item.netPrice ?? 0),
      imageUrl: extractImageUrl(item),
      category: item.category || item.categoryName || item.categoria || item.hierarchyName || "General",
    });
  }

  return dishes;
}

function parsePrice(raw: any): number {
  if (typeof raw === "number") return Math.round(raw);
  const s = String(raw).replace(/[^\d]/g, "");
  return parseInt(s, 10) || 0;
}

function extractImageUrl(item: any): string | null {
  const candidates = [item.image, item.imageUrl, item.img, item.photo, item.thumbnail];
  for (const c of candidates) {
    if (c && typeof c === "string" && c.startsWith("http")) return c;
    if (c && Array.isArray(c) && c.length > 0 && typeof c[0] === "string") return c[0];
  }
  if (Array.isArray(item.images) && item.images.length > 0) {
    const img = item.images[0];
    return typeof img === "string" ? img : img?.url || img?.src || null;
  }
  return null;
}

/**
 * Extrae Firebase config del HTML del bundle JS de Toteat.
 * Firebase siempre inyecta su config públicamente (es necesario para el cliente).
 */
async function extractFirebaseConfig(url: string): Promise<{ apiKey: string; projectId: string; databaseURL?: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; QuieroComer/1.0)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Firebase config pattern: { apiKey: "...", authDomain: "...", projectId: "..." }
    const m = html.match(/apiKey\s*:\s*["']([^"']+)["'][\s\S]{0,200}?projectId\s*:\s*["']([^"']+)["']/)
           || html.match(/projectId\s*:\s*["']([^"']+)["'][\s\S]{0,200}?apiKey\s*:\s*["']([^"']+)["']/);
    if (m) {
      const isFirstApiKey = /apiKey/.test(html.slice(0, html.indexOf(m[1])));
      const apiKey = isFirstApiKey ? m[1] : m[2];
      const projectId = isFirstApiKey ? m[2] : m[1];
      return { apiKey, projectId };
    }

    // Alternative: JSON config blob
    const jsonM = html.match(/"apiKey"\s*:\s*"([^"]+)"[\s\S]{0,200}?"projectId"\s*:\s*"([^"]+)"/);
    if (jsonM) return { apiKey: jsonM[1], projectId: jsonM[2] };

    return null;
  } catch { return null; }
}

/**
 * Busca datos del menú en el HTML directo (Toteat a veces inyecta estado inicial)
 * o en endpoints de Firebase Firestore REST API.
 */
async function tryFirestoreApi(branchId: string, firebaseConfig: { apiKey: string; projectId: string }): Promise<ExtractedDish[] | null> {
  const { apiKey, projectId } = firebaseConfig;
  const BASE = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

  // Posibles rutas en Firestore para el menú de un branch
  const PATHS = [
    `/branches/${branchId}/products`,
    `/locals/${branchId}/products`,
    `/locals/${branchId}/menu`,
    `/restaurants/${branchId}/products`,
    `/menu/${branchId}`,
    `/branches/${branchId}?fields=menu,products`,
  ];

  const tryPath = async (path: string): Promise<ExtractedDish[] | null> => {
    try {
      const url = `${BASE}${path}?key=${apiKey}&pageSize=200`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.documents?.length > 0) {
        const dishes = parseFirestoreDocuments(data.documents);
        return dishes.length >= 3 ? dishes : null;
      }
      return null;
    } catch { return null; }
  };

  const results = await Promise.all(PATHS.map(tryPath));
  const found = results.find(r => r !== null) ?? null;
  if (found) console.log(`[Toteat] Firestore success: ${found.length} dishes`);
  return found;
}

/** Convierte documentos de Firestore al formato ExtractedDish */
function parseFirestoreDocuments(docs: any[]): ExtractedDish[] {
  return docs.map(doc => {
    const f = doc.fields || {};
    const get = (key: string): any => {
      const field = f[key];
      if (!field) return null;
      return field.stringValue ?? field.integerValue ?? field.doubleValue ?? field.booleanValue ?? null;
    };

    return {
      name: (get("name") || get("nombre") || "").toString().trim(),
      description: (get("description") || get("descripcion") || "").toString(),
      price: parsePrice(get("price") || get("precio") || 0),
      imageUrl: get("imageUrl") || get("image") || get("img") || null,
      category: (get("category") || get("categoryName") || get("categoria") || "General").toString(),
    };
  }).filter(d => d.name.length > 1);
}

/**
 * Fallback: Jina rendering → Claude para parsear el menú renderizado.
 * Jina ejecuta JavaScript, lo que debería mostrar el menú completo.
 */
async function tryJinaWithClaude(url: string, slug: string): Promise<ExtractionResult> {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

  console.log("[Toteat] Trying Jina rendering for:", url);
  const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
    headers: {
      Accept: "text/plain",
      "X-No-Cache": "true",
      "X-Timeout": "35000",
    },
    signal: AbortSignal.timeout(38000),
  });
  if (!jinaRes.ok) throw new Error(`Jina failed: ${jinaRes.status}`);
  const content = await jinaRes.text();
  console.log("[Toteat] Jina content length:", content.length);

  if (content.length < 200) throw new Error("Jina returned empty content for Toteat");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 16000,
      messages: [{
        role: "user",
        content: `Extrae el menú completo de este restaurante Toteat.
URL: ${url}
Contenido:
${content.slice(0, 30000)}

Responde con JSON:
{"restaurantName":"...","logo":"URL o null","categories":[{"name":"...","dishes":[{"name":"...","description":"...","price":8990,"photo":"URL o null"}]}]}

REGLAS: Precios como enteros sin puntos ($8.990→8990). SOLO JSON. Es crítico que el JSON esté completo y bien cerrado.`,
      }],
    }),
  });

  if (!res.ok) throw new Error(`Claude error: ${res.status}`);
  const data = await res.json();
  const text: string = data.content?.[0]?.text ?? "";

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in Claude response");

  let parsed: any;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    // JSON truncado — intentar recuperar categorías parciales
    const partial = jsonMatch[0].replace(/,?\s*\{[^{}]*$/, '').replace(/,?\s*\[[^\[\]]*$/, '');
    const fixed = partial + (partial.includes('"categories"') ? ']}]}' : '}}');
    try {
      parsed = JSON.parse(fixed);
    } catch {
      throw new Error(`JSON inválido en respuesta de Claude: ${(jsonMatch[0]).slice(0, 200)}`);
    }
  }

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
      });
    }
  }

  return {
    restaurantName: parsed.restaurantName || slug,
    dishes,
    logoUrl: parsed.logo || null,
    bannerUrl: null,
  };
}

export async function extractToteat(cartaUrl: string): Promise<ExtractionResult> {
  const parsed = parseToteatUrl(cartaUrl);
  if (!parsed) throw new Error(`URL de Toteat no válida: ${cartaUrl}`);

  const { country, slug, branchId } = parsed;
  console.log(`[Toteat] Extracting: slug=${slug} branchId=${branchId}`);

  // Step 1: Try public API endpoints
  const apiDishes = await tryToteatPublicApi(branchId, slug);
  if (apiDishes && apiDishes.length >= 3) {
    console.log(`[Toteat] API extraction: ${apiDishes.length} dishes`);
    return {
      restaurantName: slug.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\d+$/, "").trim(),
      dishes: apiDishes,
      logoUrl: null,
      bannerUrl: null,
    };
  }

  // Step 2: Extract Firebase config from HTML → Firestore REST API
  const firebaseConfig = await extractFirebaseConfig(cartaUrl);
  if (firebaseConfig) {
    console.log(`[Toteat] Firebase config found: projectId=${firebaseConfig.projectId}`);
    const firestoreDishes = await tryFirestoreApi(branchId, firebaseConfig);
    if (firestoreDishes && firestoreDishes.length >= 3) {
      return {
        restaurantName: slug.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\d+$/, "").trim(),
        dishes: firestoreDishes,
        logoUrl: null,
        bannerUrl: null,
      };
    }
  }

  // Step 3: Fallback — Jina rendering + Claude
  return tryJinaWithClaude(cartaUrl, slug);
}
