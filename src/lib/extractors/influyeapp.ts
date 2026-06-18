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

  for (const section of data.menu) {
    const categoryName: string = section.title || "General";
    if (!Array.isArray(section.items)) continue;

    for (const item of section.items) {
      // Saltar invisibles, no disponibles y modificadores (type !== 0)
      if (item.invisible || item.unavailable) continue;
      if (!item.title) continue;

      const imageUrl = item.image
        ? `${IMAGE_BASE}/${item.image}`
        : null;

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
