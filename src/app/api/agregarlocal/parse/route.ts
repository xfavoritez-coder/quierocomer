import { NextResponse } from "next/server";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-6";

export async function POST(request: Request) {
  try {
    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    const formData = await request.formData();
    const name = formData.get("name") as string;
    const files = formData.getAll("photos") as File[];

    if (!name?.trim()) {
      return NextResponse.json({ error: "Nombre del local requerido" }, { status: 400 });
    }
    if (files.length === 0) {
      return NextResponse.json({ error: "Sube al menos una foto de la carta" }, { status: 400 });
    }

    // Convert images to base64 — normalize media types for Anthropic API
    const VALID_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
    const normalizeType = (t: string) => {
      if (VALID_TYPES.has(t)) return t;
      if (t === "image/jpg") return "image/jpeg";
      if (t.startsWith("image/heic") || t.startsWith("image/heif")) return "image/jpeg";
      return "image/jpeg"; // fallback
    };

    const images: { type: "image"; source: { type: "base64"; media_type: string; data: string } }[] = [];
    for (const file of files.slice(0, 5)) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const base64 = buffer.toString("base64");
      const mediaType = normalizeType(file.type);
      images.push({
        type: "image",
        source: { type: "base64", media_type: mediaType, data: base64 },
      });
    }

    const prompt = `Analiza estas fotos de la carta/menú del restaurante "${name}".

Extrae TODOS los platos que puedas ver y organízalos por categoría.

Responde SOLO con un JSON válido con esta estructura exacta:
{
  "categories": [
    {
      "name": "Nombre de la categoría",
      "type": "food" | "drink" | "dessert",
      "dishes": [
        {
          "name": "Nombre del plato",
          "description": "Descripción si la tiene, null si no",
          "price": 8990,
          "diet": "OMNIVORE" | "VEGAN" | "VEGETARIAN" | "PESCETARIAN",
          "isSpicy": false
        }
      ]
    }
  ]
}

Reglas:
- Los precios deben ser números enteros (sin puntos ni símbolos). Ej: $8.990 → 8990
- Si un plato no tiene precio visible, pon 0
- "type" debe ser "food" para comida, "drink" para bebidas, "dessert" para postres
- Detecta dieta si hay íconos/marcas de vegano (🌿/V), vegetariano (🌱), etc. Si no hay indicador, pon "OMNIVORE"
- Si ves marcas de picante/spicy, pon isSpicy: true
- No inventes platos, solo extrae lo que ves en las fotos
- Responde SOLO el JSON, sin texto adicional`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        messages: [{
          role: "user",
          content: [
            ...images,
            { type: "text", text: prompt },
          ],
        }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[agregarlocal] Claude API error:", res.status, err);
      return NextResponse.json({ error: `Error API (${res.status}): ${err.slice(0, 200)}` }, { status: 500 });
    }

    const data = await res.json();
    const text: string = data.content?.[0]?.text || "";

    // Extract JSON from response
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return NextResponse.json({ error: "No se pudo extraer datos de las fotos" }, { status: 500 });
    }

    const parsed = JSON.parse(match[0]);
    return NextResponse.json(parsed);
  } catch (e: any) {
    console.error("[agregarlocal parse]", e);
    return NextResponse.json({ error: e.message || "Error interno" }, { status: 500 });
  }
}
