import type { ExtractionResult, ExtractedDish } from "./types";

/**
 * Extract menu from Showspace (showspace.cl) — Next.js App Router site.
 * Menu data is embedded in self.__next_f.push RSC chunks in the initial HTML.
 *
 * JSON structure found in page:
 * - categories: [{ id_categoria, nombre, orden, ... }]
 * - items / productos: [{ id_producto, titulo, descripcion, precio, url_imagen, id_categoria,
 *     vegetariano, vegano, picante, sin_lactosa, available, visible, display_order }]
 */
export async function extractShowspace(cartaUrl: string): Promise<ExtractionResult> {
  console.log("[Showspace] Fetching HTML:", cartaUrl);

  const res = await fetch(cartaUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "es-CL,es;q=0.9",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Failed to fetch ${cartaUrl}: ${res.status}`);
  const html = await res.text();

  // Collect all RSC chunk strings from self.__next_f.push([1, "..."])
  const chunkStrings: string[] = [];

  // Pattern 1: self.__next_f.push([1,"..."])
  const rscMatches = [...html.matchAll(/self\.__next_f\.push\(\[1,\s*"((?:[^"\\]|\\[\s\S])*?)"\]\)/g)];
  for (const m of rscMatches) {
    try {
      // The string is JSON-encoded — decode escape sequences
      const decoded = JSON.parse(`"${m[1]}"`);
      chunkStrings.push(decoded);
    } catch {}
  }

  // Pattern 2: inline <script> tags with JSON payload
  const scriptMatches = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const m of scriptMatches) {
    const content = m[1].trim();
    if (content.includes("id_producto") || content.includes("categorias") || content.includes("productos")) {
      chunkStrings.push(content);
    }
  }

  // Try to find product and category data in the collected chunks
  let categories: Array<{ id: number; nombre: string }> = [];
  let products: Array<{
    id_producto: number;
    titulo: string;
    descripcion?: string;
    precio: number;
    url_imagen?: string;
    id_categoria: number;
    vegetariano?: boolean;
    vegano?: boolean;
    picante?: boolean;
    available?: boolean;
    visible?: boolean;
  }> = [];

  // Also search the full HTML body for embedded JSON arrays
  const allSources = [...chunkStrings, html];

  for (const src of allSources) {
    // Look for arrays/objects containing id_producto
    const productMatches = [...src.matchAll(/\{[^{}]*"id_producto"\s*:\s*\d+[^{}]*\}/g)];
    for (const pm of productMatches) {
      try {
        const obj = JSON.parse(pm[0]);
        if (obj.id_producto && obj.titulo) {
          products.push(obj);
        }
      } catch {}
    }

    // Look for arrays with category data (id_categoria + nombre)
    const catMatches = [...src.matchAll(/\{[^{}]*"id_categoria"\s*:\s*\d+[^{}]*"nombre"\s*:\s*"[^"]*"[^{}]*\}/g)];
    for (const cm of catMatches) {
      try {
        const obj = JSON.parse(cm[0]);
        if (obj.id_categoria && obj.nombre) {
          categories.push({ id: obj.id_categoria, nombre: obj.nombre });
        }
      } catch {}
    }
    // Also try reverse order (nombre before id_categoria)
    const catMatches2 = [...src.matchAll(/\{[^{}]*"nombre"\s*:\s*"[^"]*"[^{}]*"id_categoria"\s*:\s*\d+[^{}]*\}/g)];
    for (const cm of catMatches2) {
      try {
        const obj = JSON.parse(cm[0]);
        if (obj.id_categoria && obj.nombre) {
          categories.push({ id: obj.id_categoria, nombre: obj.nombre });
        }
      } catch {}
    }

    // Look for larger JSON objects that contain nested products/categories arrays
    if (products.length === 0) {
      // Try to find embedded JSON blobs
      const jsonBlobMatches = [...src.matchAll(/(\{[\s\S]{200,}?\})/g)];
      for (const jm of jsonBlobMatches) {
        try {
          const obj = JSON.parse(jm[1]);
          // Look for products array
          const items = obj?.items || obj?.productos || obj?.products || obj?.menu_items;
          if (Array.isArray(items) && items.length > 0 && items[0]?.id_producto) {
            products.push(...items);
          }
          // Look for categories array
          const cats = obj?.categorias || obj?.categories;
          if (Array.isArray(cats) && cats.length > 0 && cats[0]?.id_categoria) {
            categories = cats.map((c: any) => ({ id: c.id_categoria, nombre: c.nombre }));
          }
        } catch {}
      }
    }
  }

  // Deduplicate products and categories
  const seenProductIds = new Set<number>();
  products = products.filter((p) => {
    if (seenProductIds.has(p.id_producto)) return false;
    seenProductIds.add(p.id_producto);
    return true;
  });
  const seenCatIds = new Set<number>();
  categories = categories.filter((c) => {
    if (seenCatIds.has(c.id)) return false;
    seenCatIds.add(c.id);
    return true;
  });

  // Filter: only visible/available products
  const visibleProducts = products.filter((p) => p.available !== false && p.visible !== false);

  if (visibleProducts.length === 0) {
    throw new Error(`Showspace: no products found in HTML (fetched ${html.length} bytes, found ${products.length} raw products)`);
  }

  // Build category map
  const catMap = new Map<number, string>();
  for (const cat of categories) {
    catMap.set(cat.id, cat.nombre);
  }

  // If no categories from HTML, derive from product data
  if (catMap.size === 0) {
    for (const p of visibleProducts) {
      if (!catMap.has(p.id_categoria)) {
        catMap.set(p.id_categoria, `Categoría ${p.id_categoria}`);
      }
    }
  }

  const dishes: ExtractedDish[] = visibleProducts.map((p) => ({
    name: p.titulo.trim(),
    description: p.descripcion?.trim() || "",
    price: typeof p.precio === "number" ? p.precio : parseInt(String(p.precio).replace(/\D/g, ""), 10) || 0,
    imageUrl: p.url_imagen || null,
    category: catMap.get(p.id_categoria) || "General",
    diet: p.vegano ? "VEGAN" : p.vegetariano ? "VEGETARIAN" : "OMNIVORE",
    isSpicy: p.picante || false,
  }));

  // Extract restaurant name from <title> or og:title
  let restaurantName = "Restaurante";
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    restaurantName = titleMatch[1].trim().split("|")[0].split("-")[0].trim();
  }
  const ogTitleMatch = html.match(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  if (ogTitleMatch) {
    restaurantName = ogTitleMatch[1].trim().split("|")[0].split("-")[0].trim();
  }

  // Extract logo from og:image
  let logoUrl: string | null = null;
  const ogImageMatch = html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  if (ogImageMatch) logoUrl = ogImageMatch[1];

  console.log("[Showspace] Extracted:", dishes.length, "dishes,", categories.length, "categories from", restaurantName);

  return { restaurantName, dishes, logoUrl, bannerUrl: null };
}
