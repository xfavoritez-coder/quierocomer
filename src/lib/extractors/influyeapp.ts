/**
 * Influye.app extractor — plataforma chilena de pedidos online.
 *
 * Cada tienda tiene su propio dominio personalizado (ej: misterponchoburgers.cl)
 * pero carga scripts de static.influye.app y consume la API de backend.influye.app.
 *
 * El backend identifica la tienda mediante el header Referer de la petición.
 * Endpoint: GET https://backend.influye.app/store/totem/menu
 */

import type { ExtractionResult, ExtractedDish } from "./types";

const API_BASE = "https://backend.influye.app/store";
const IMAGE_BASE = "https://static.influye.app/storage/products";

function resolveInfluyeImageUrl(item: Record<string, any>): string | null {
  // Try all known field names
  const raw = item.image ?? item.imageUrl ?? item.img ?? item.img_url ?? item.image_url ?? item.photo ?? item.thumbnail ?? null;
  if (!raw || typeof raw !== "string") return null;
  if (raw.startsWith("http")) return raw;          // already full URL
  if (raw.startsWith("/")) return `https://static.influye.app${raw}`;  // absolute path
  return `${IMAGE_BASE}/${raw}`;                   // relative filename
}

/** Detecta si una URL pertenece a una tienda influye.app */
export async function isInfluyeApp(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return false;
    const html = await res.text();
    return html.includes("static.influye.app") || html.includes("backend.influye.app");
  } catch { return false; }
}

export async function extractInfluyeApp(storeUrl: string): Promise<ExtractionResult> {
  const origin = new URL(storeUrl).origin;

  const res = await fetch(`${API_BASE}/totem/menu`, {
    headers: {
      "Accept": "application/json",
      "Origin": origin,
      "Referer": storeUrl.endsWith("/") ? storeUrl : storeUrl + "/",
      "User-Agent": "Mozilla/5.0",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`Influye.app API error: ${res.status}`);
  const data = await res.json();

  if (!Array.isArray(data?.menu)) throw new Error("Respuesta inesperada de influye.app");

  const dishes: ExtractedDish[] = [];

  // Debug: log first item keys to diagnose image field name in future
  const firstItem = data.menu[0]?.items?.[0];
  if (firstItem) {
    console.log(`[InfluyeApp] First item keys: ${Object.keys(firstItem).join(", ")}`);
    console.log(`[InfluyeApp] First item.image: ${JSON.stringify(firstItem.image)}, .imageUrl: ${JSON.stringify(firstItem.imageUrl)}`);
  }

  for (const section of data.menu) {
    const categoryName: string = section.title || "General";
    if (!Array.isArray(section.items)) continue;

    for (const item of section.items) {
      // Saltar invisibles, no disponibles y modificadores (type !== 0)
      if (item.invisible || item.unavailable) continue;
      if (!item.title) continue;

      const imageUrl = resolveInfluyeImageUrl(item);

      dishes.push({
        name: item.title.trim(),
        description: item.description || "",
        price: typeof item.price === "number" ? Math.round(item.price) : 0,
        imageUrl,
        category: categoryName,
      });
    }
  }

  console.log(`[InfluyeApp] ${dishes.length} platos extraídos de ${storeUrl}`);

  // Nombre del restaurante desde meta og:title si está disponible, si no desde el hostname
  const restaurantName = new URL(storeUrl).hostname
    .replace(/^www\./, "")
    .split(".")[0]
    .replace(/-/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());

  return { restaurantName, dishes, logoUrl: null, bannerUrl: null };
}
