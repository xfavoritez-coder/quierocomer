import type { ExtractionResult, ExtractedDish } from "./types";

/**
 * Extract menu from GetAgil-powered restaurant sites.
 * GetAgil embeds the full menu as JSON in the HTML under the key "categorias".
 * Structure: { categorias: [{ Nombre, productos: [{ Nombre, Descripcion, PrecioFinal, Imagen, EstaPausado }] }] }
 */
export async function extractGetagil(cartaUrl: string): Promise<ExtractionResult> {
  const url = new URL(cartaUrl);
  url.pathname = "/pedir";
  url.search = "";
  url.hash = "";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const res = await fetch(url.toString(), {
    signal: controller.signal,
    headers: { "User-Agent": "QuieroComer-Bot/1.0" },
    redirect: "follow",
  });
  clearTimeout(timeout);

  if (!res.ok) throw new Error(`GetAgil fetch failed: ${res.status}`);
  const html = await res.text();

  // Find the JSON blob that contains "categorias"
  const match = html.match(/"categorias":\s*(\[[\s\S]*?\]),"destacados"/)
  if (!match) throw new Error("GetAgil: no se encontró JSON de categorias en el HTML");

  let categorias: any[]
  try {
    categorias = JSON.parse(match[1])
  } catch {
    throw new Error("GetAgil: JSON de categorias inválido")
  }

  const dishes: ExtractedDish[] = []

  for (const cat of categorias) {
    const catName: string = cat.Nombre || "General"
    const productos: any[] = cat.productos || []

    for (const p of productos) {
      if (p.EstaPausado) continue
      const name: string = (p.Nombre || "").trim()
      if (!name) continue
      const price: number = p.PrecioFinal || p.PrecioNormal || 0
      const description: string = (p.Descripcion || "").trim() || null as any
      const imageUrl: string | null = p.Imagen || p.ImagenSM || null

      dishes.push({ name, description, price, imageUrl, category: catName })
    }
  }

  // Restaurant name from title
  const titleMatch = html.match(/<title>([^<]+)<\/title>/)
  const restaurantName = titleMatch?.[1]?.trim() || "Restaurante"

  // Logo
  const logoMatch = html.match(/"Logo\.png[^"]*"\s*src="([^"]+)"|src="([^"]+Logo[^"]+)"/)
  const logoUrl: string | null = null

  return { restaurantName, dishes, logoUrl, bannerUrl: null }
}
