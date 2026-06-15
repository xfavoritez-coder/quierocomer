/**
 * OlaClick extractor — v2: sitemap-first strategy.
 *
 * OlaClick SPAs show a "closed" modal and lazy-load products.
 * Instead of fighting the SPA, we:
 * 1. Parse sitemap.xml → get all category/product slugs
 * 2. Fetch each product page individually via Jina (no modal, clean render)
 * 3. Extract name, price, photo, description from each page
 * 4. Group by category from the URL structure
 *
 * No Claude needed — structured data from individual product pages.
 */

import type { ExtractionResult, ExtractedDish } from "./types";

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

/** Ensure URL has /products */
function resolveProductsUrl(cartaUrl: string): string {
  try {
    const url = new URL(cartaUrl);
    if (!url.pathname.includes("/products")) url.pathname = "/products";
    return url.toString();
  } catch { return cartaUrl; }
}

/** Parse sitemap → { category: [productSlug, ...] } */
async function parseSitemap(origin: string): Promise<Record<string, string[]>> {
  const res = await fetch(`${origin}/sitemap.xml`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return {};
  const xml = await res.text();

  const host = new URL(origin).hostname;
  const re = new RegExp(`${host.replace(/\./g, "\\.")}/([a-z0-9-]+)/([a-z0-9-]+)`, "gi");
  const categories: Record<string, string[]> = {};
  let m;
  while ((m = re.exec(xml)) !== null) {
    const cat = m[1];
    const product = m[2];
    if (["products", "info", "checkout", "cart", "_nuxt"].includes(cat)) continue;
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(product);
  }
  return categories;
}

/** Extract logo from root page */
async function extractLogo(origin: string): Promise<string | null> {
  try {
    const res = await fetch(origin, { signal: AbortSignal.timeout(8000), headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await res.text();
    const match = html.match(/logo_url\s*:\s*"([^"]+)"/) || html.match(/logo_thumbnail_url\s*:\s*"([^"]+)"/);
    return match ? match[1].replace(/\\u002F/g, "/") : null;
  } catch { return null; }
}

/** Fetch a single product page via Jina → extract name, price, photo, description */
async function fetchProduct(url: string): Promise<ExtractedDish | null> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: "text/plain", "X-No-Cache": "true" },
      signal: AbortSignal.timeout(12000),
    });
    const text = await res.text();
    if (text.length < 100) return null;

    // Extract name from first H1
    const name = text.match(/^#\s+([^\n-]+)/m)?.[1]?.trim();
    if (!name || name.length < 2) return null;

    // Extract price
    const priceMatch = text.match(/Precio:\s*\$\s*([\d.,]+)/) || text.match(/\$\s*([\d.,]+)/);
    const price = priceMatch ? parseInt(priceMatch[1].replace(/\./g, "").replace(",", ""), 10) : 0;

    // Extract photo (cloudfront CDN)
    const photo = text.match(/https:\/\/d2nagnwby8accc\.cloudfront\.net\/[^\s")\]]+/)?.[0]
      || text.match(/https:\/\/assets\.olaclick\.app\/companies\/products\/images\/[^\s")\]]+/)?.[0]
      || null;

    // Extract description from H2
    const desc = text.match(/^##\s+([^\n]+)/m)?.[1]?.trim() || "";

    return { name, description: desc, price, imageUrl: photo, category: "" };
  } catch { return null; }
}

function slugToName(slug: string): string {
  return slug.replace(/-/g, " ").split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export async function extractOlaClick(cartaUrl: string): Promise<ExtractionResult> {
  const origin = new URL(resolveProductsUrl(cartaUrl)).origin;
  console.log("[OlaClick v2] Starting extraction:", origin);

  // Step 1: Parse sitemap + get logo
  const [categories, logoUrl] = await Promise.all([
    parseSitemap(origin),
    extractLogo(origin),
  ]);

  const catNames = Object.keys(categories);
  const totalProducts = Object.values(categories).flat().length;
  console.log(`[OlaClick v2] Sitemap: ${catNames.length} categories, ${totalProducts} products | Logo: ${logoUrl ? "found" : "none"}`);

  if (catNames.length === 0) {
    throw new Error("OlaClick: sitemap vacío o no disponible");
  }

  // Filter out drink categories
  const drinkCats = new Set(["bebidas", "jugos", "jugos-naturales-y-bebidas", "cervezas", "vinos", "tragos", "cocktails", "licores", "bebestibles"]);
  const foodCats = catNames.filter(c => !drinkCats.has(c));

  // Step 2: Fetch product pages in parallel batches
  const dishes: ExtractedDish[] = [];
  const BATCH = 5;

  for (const cat of foodCats) {
    const products = categories[cat];
    const catName = slugToName(cat);
    console.log(`[OlaClick v2] Category "${catName}": ${products.length} products`);

    for (let i = 0; i < products.length; i += BATCH) {
      const batch = products.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map(p => fetchProduct(`${origin}/${cat}/${p}`))
      );

      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          r.value.category = catName;
          dishes.push(r.value);
        }
      }
      await sleep(500); // rate limit
    }
  }

  console.log(`[OlaClick v2] Extracted ${dishes.length} dishes from ${foodCats.length} food categories`);

  if (dishes.length === 0) {
    throw new Error("OlaClick: no se extrajeron platos");
  }

  // Extract restaurant name from origin
  const storeSlug = new URL(origin).hostname.split(".")[0];
  const restaurantName = slugToName(storeSlug);

  return {
    restaurantName,
    dishes,
    logoUrl,
    bannerUrl: null,
  };
}
