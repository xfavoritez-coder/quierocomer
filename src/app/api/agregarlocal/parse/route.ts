import { NextResponse } from "next/server";
import sharp from "sharp";

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

    // Convert all images to JPEG via sharp, with fallback for unsupported formats
    const images: { type: "image"; source: { type: "base64"; media_type: string; data: string } }[] = [];
    for (const file of files.slice(0, 5)) {
      const inputBuffer = Buffer.from(await file.arrayBuffer());
      let base64: string;
      let mediaType: string = "image/jpeg";
      try {
        const jpegBuffer = await sharp(inputBuffer)
          .jpeg({ quality: 85 })
          .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
          .toBuffer();
        base64 = jpegBuffer.toString("base64");
      } catch {
        // Fallback: send original bytes — works for JPEG/PNG/WebP/GIF
        base64 = inputBuffer.toString("base64");
        const ft = file.type;
        if (ft === "image/png" || ft === "image/webp" || ft === "image/gif") mediaType = ft;
      }
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
      return NextResponse.json({ error: `Error al analizar: ${JSON.parse(err)?.error?.message || err.slice(0, 150)}` }, { status: 500 });
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
