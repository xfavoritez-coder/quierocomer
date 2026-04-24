import { NextResponse } from "next/server";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;
const MODEL = "claude-sonnet-4-6";

async function searchUnsplash(query: string): Promise<string | null> {
  if (!UNSPLASH_KEY) return null;
  try {
    const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query + " food")}&per_page=1&orientation=landscape`, {
      headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.results?.[0]?.urls?.regular || null;
  } catch { return null; }
}

export async function POST(request: Request) {
  try {
    if (!ANTHROPIC_API_KEY) return NextResponse.json({ error: "API not configured" }, { status: 500 });

    const { url, name: providedName } = await request.json();
    if (!url?.trim()) return NextResponse.json({ error: "URL requerida" }, { status: 400 });

    // Fetch the webpage content — use Jina Reader to handle SPAs/JS-rendered pages
    let pageContent: string;
    try {
      // Try Jina Reader first (renders JS, extracts readable content)
      const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
        headers: { "Accept": "text/plain", "X-No-Cache": "true" },
      });
      if (jinaRes.ok) {
        pageContent = await jinaRes.text();
      } else {
        // Fallback to direct fetch
        const directRes = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; QuieroComer/1.0)" },
          redirect: "follow",
        });
        if (!directRes.ok) throw new Error(`HTTP ${directRes.status}`);
        pageContent = await directRes.text();
      }
    } catch (e: any) {
      return NextResponse.json({ error: `No se pudo acceder a la URL: ${e.message}` }, { status: 400 });
    }

    // Trim to avoid token limits
    const trimmedHtml = pageContent.slice(0, 80000);

    const prompt = `Analiza el HTML de esta página web de un restaurante y extrae toda la información del menú/carta.

URL: ${url}
${providedName ? `Nombre del local: ${providedName}` : ""}

HTML:
${trimmedHtml}

Extrae TODA la información y responde con un JSON válido con esta estructura:
{
  "restaurantName": "Nombre del restaurante (extráelo del HTML si no se proporcionó)",
  "logo": "URL del logo si lo encuentras en el HTML (busca en favicon, og:image, img con logo/brand en el alt/class)",
  "categories": [
    {
      "name": "Nombre de la categoría",
      "type": "food" | "drink" | "dessert",
      "dishes": [
        {
          "name": "Nombre del plato",
          "description": "Descripción completa si la tiene, null si no",
          "price": 8990,
          "photo": "URL completa de la foto del plato si existe en el HTML, null si no tiene",
          "diet": "OMNIVORE" | "VEGAN" | "VEGETARIAN",
          "isSpicy": false,
          "modifiers": [
            {
              "name": "Nombre del grupo de opciones (ej: Elige proteína, Tamaño, Extras)",
              "required": true,
              "options": [
                { "name": "Opción", "price": 0 }
              ]
            }
          ]
        }
      ]
    }
  ]
}

Reglas:
- Precios: números enteros sin puntos ni símbolos. $8.990 → 8990
- Si no hay precio visible, pon 0
- Fotos: extrae la URL completa del src de las imágenes. Si son URLs relativas, conviértelas a absolutas usando el dominio base
- Si una foto parece ser un placeholder genérico (ej: "no-image.png", "default.jpg"), pon null
- Modificadores: detecta opciones, extras, tamaños, adiciones. Solo si existen en el HTML
- El precio de los modificadores es el precio ADICIONAL (0 si no tiene costo extra)
- Logo: busca en meta tags (og:image, apple-touch-icon), favicon, o imgs con class/alt que indiquen logo
- No inventes datos, solo extrae lo que está en el HTML
- Responde SOLO el JSON`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 8192, messages: [{ role: "user", content: prompt }] }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[scrape] Claude error:", res.status, err);
      return NextResponse.json({ error: "Error al analizar la página" }, { status: 500 });
    }

    const data = await res.json();
    const text: string = data.content?.[0]?.text || "";

    // Parse JSON — handle truncated output
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json({ error: "No se pudo extraer datos" }, { status: 500 });

    let jsonStr = match[0];
    try { JSON.parse(jsonStr); } catch {
      // Fix truncated JSON
      jsonStr = jsonStr.replace(/,\s*\{[^}]*$/, "").replace(/,\s*"[^"]*$/, "").replace(/,\s*$/, "");
      let o = 0, c = 0; for (const ch of jsonStr) { if (ch === "[") o++; if (ch === "]") c++; }
      for (let i = 0; i < o - c; i++) jsonStr += "]";
      o = 0; c = 0; for (const ch of jsonStr) { if (ch === "{") o++; if (ch === "}") c++; }
      for (let i = 0; i < o - c; i++) jsonStr += "}";
    }

    const parsed = JSON.parse(jsonStr);

    // Count dishes with and without photos
    let withPhoto = 0, withoutPhoto = 0;
    for (const cat of (parsed.categories || [])) {
      for (const dish of (cat.dishes || [])) {
        if (dish.photo) withPhoto++; else withoutPhoto++;
      }
    }

    // Fill missing photos with Unsplash
    if (withoutPhoto > 0 && UNSPLASH_KEY) {
      // Generate queries for dishes without photos
      const dishesNeedingPhotos = [];
      for (const cat of (parsed.categories || [])) {
        for (const dish of (cat.dishes || [])) {
          if (!dish.photo) dishesNeedingPhotos.push(dish);
        }
      }

      // Batch search — max 10 to stay within rate limits
      for (const dish of dishesNeedingPhotos.slice(0, 10)) {
        const query = (dish.name || "").replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ\s]/g, "").trim();
        if (!query) continue;
        const photo = await searchUnsplash(query);
        if (photo) {
          dish.photo = photo;
          dish._unsplash = true;
        }
      }
    }

    return NextResponse.json({
      ...parsed,
      restaurantName: parsed.restaurantName || providedName || "Sin nombre",
      stats: { withPhoto, withoutPhoto, filledWithUnsplash: (parsed.categories || []).flatMap((c: any) => c.dishes || []).filter((d: any) => d._unsplash).length },
    });
  } catch (e: any) {
    console.error("[scrape]", e);
    return NextResponse.json({ error: e.message || "Error" }, { status: 500 });
  }
}
