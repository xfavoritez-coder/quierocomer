import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 120;

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;
const MODEL = "claude-sonnet-4-6";

export async function POST(request: Request) {
  try {
    const { restaurantId } = await request.json();
    if (!restaurantId) return NextResponse.json({ error: "Missing restaurantId" }, { status: 400 });

    // Get all dishes for this restaurant
    const dishes = await prisma.dish.findMany({
      where: { restaurantId, isActive: true, deletedAt: null },
      select: { id: true, name: true, description: true, photos: true },
      orderBy: { position: "asc" },
    });

    // Filter dishes without photos
    const needsPhotos = dishes.filter(d => !d.photos?.length);
    if (needsPhotos.length === 0) {
      return NextResponse.json({ results: [], message: "Todos los platos ya tienen fotos" });
    }

    // Use Claude to generate search queries for each dish
    if (!ANTHROPIC_API_KEY) return NextResponse.json({ error: "API not configured" }, { status: 500 });

    const dishList = needsPhotos.map(d => `- "${d.name}": ${d.description || "sin descripción"}`).join("\n");
    const prompt = `Para cada plato de este restaurante, genera un query de búsqueda en inglés optimizado para encontrar una foto de comida en un banco de imágenes. El query debe ser específico al plato, no genérico.

Platos:
${dishList}

Responde SOLO con un JSON array donde cada elemento tiene:
{ "id": "dish_id", "query": "english search query" }

IDs de los platos: ${needsPhotos.map(d => d.id).join(", ")}

Reglas:
- Query en inglés, máximo 4 palabras
- Enfócate en el ingrediente principal o estilo del plato
- Ej: "Ceviche Mediterráneo" → "mediterranean ceviche fresh"
- Ej: "Brownie con helado" → "chocolate brownie ice cream"
- Responde SOLO el JSON array`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 2048, messages: [{ role: "user", content: prompt }] }),
    });

    if (!res.ok) return NextResponse.json({ error: "Error generando queries" }, { status: 500 });

    const data = await res.json();
    const text = data.content?.[0]?.text || "";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return NextResponse.json({ error: "No se pudieron generar queries" }, { status: 500 });

    const queries: { id: string; query: string }[] = JSON.parse(match[0]);

    // Search Unsplash for each query
    const results: { dishId: string; dishName: string; query: string; photoUrl: string | null }[] = [];

    for (const q of queries) {
      const dish = needsPhotos.find(d => d.id === q.id);
      if (!dish) continue;

      let photoUrl: string | null = null;
      try {
        if (UNSPLASH_KEY) {
          // Use Unsplash API if key available
          const searchRes = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q.query + " food")}&per_page=1&orientation=landscape`, {
            headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
          });
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            if (searchData.results?.[0]) {
              photoUrl = searchData.results[0].urls.regular;
            }
          }
        } else {
          // Fallback: use source.unsplash.com (no API key needed)
          photoUrl = `https://source.unsplash.com/800x600/?${encodeURIComponent(q.query + ",food,dish")}`;
        }
      } catch {}

      results.push({ dishId: dish.id, dishName: dish.name, query: q.query, photoUrl });
    }

    return NextResponse.json({ results, total: needsPhotos.length });
  } catch (e: any) {
    console.error("[agregarlocal photos]", e);
    return NextResponse.json({ error: e.message || "Error" }, { status: 500 });
  }
}

// Apply selected photos to dishes
export async function PUT(request: Request) {
  try {
    const { photos } = await request.json(); // [{ dishId, photoUrl }]
    if (!photos?.length) return NextResponse.json({ error: "No photos" }, { status: 400 });

    let applied = 0;
    for (const p of photos) {
      if (!p.dishId || !p.photoUrl) continue;
      await prisma.dish.update({
        where: { id: p.dishId },
        data: { photos: [p.photoUrl] },
      });
      applied++;
    }

    return NextResponse.json({ ok: true, applied });
  } catch (e: any) {
    console.error("[agregarlocal photos PUT]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
