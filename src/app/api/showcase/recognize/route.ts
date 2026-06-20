import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

async function urlToBase64(url: string): Promise<{ data: string; mediaType: "image/webp" | "image/jpeg" | "image/png" }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get("content-type") ?? "image/webp";
  const mediaType = ct.includes("jpeg") ? "image/jpeg" : ct.includes("png") ? "image/png" : "image/webp";
  return { data: buffer.toString("base64"), mediaType };
}

export async function POST(req: NextRequest) {
  try {
    const { photos } = await req.json() as { photos: string[] };
    if (!photos?.length) return NextResponse.json({ dishes: [] });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ dishes: photos.map((_, i) => ({ name: '', description: null, type: 'plato', photoIndex: i })) });
    }

    const client = new Anthropic({ apiKey });

    const results = await Promise.allSettled(
      photos.map(async (url, i) => {
        try {
          const { data, mediaType } = await urlToBase64(url);

          const msg = await client.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 200,
            messages: [{
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: mediaType, data } },
                { type: "text", text: '¿Qué aparece en esta foto? Responde SOLO con JSON válido: {"name":"nombre en español","description":"descripción breve o null","type":"plato|bebida|extra"}\n- type="plato" si es un plato principal, entrada o postre\n- type="bebida" si es una bebida (agua, jugo, vino, cerveza, trago, cóctel, mojito, caipirinha, pisco sour, etc.)\n- type="extra" si es un condimento, salsa, guarnición suelta o accesorio (ej: salsa soya, pebre, almendras, limón)\nUsa vocabulario latinoamericano: palta (no aguacate), durazno (no melocotón), ananá (no piña), frutilla (no fresa), poroto (no judía/alubia), arvejas (no guisantes), choclo (no maíz/elote), zapallo (no calabaza), marraqueta (no barra de pan), damasco (no albaricoque).' }
              ]
            }]
          });

          const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
          const match = text.match(/\{[\s\S]*?\}/);
          if (!match) return { name: '', description: null, photoIndex: i };
          const parsed = JSON.parse(match[0]);
          return { name: parsed.name || '', description: parsed.description || null, type: parsed.type || 'plato', photoIndex: i };
        } catch (e: any) {
          console.error(`[showcase/recognize] foto ${i} error:`, e?.message);
          return { name: '', description: null, photoIndex: i };
        }
      })
    );

    return NextResponse.json({
      dishes: results.map((r, i) =>
        r.status === "fulfilled" ? r.value : { name: '', description: null, type: 'plato', photoIndex: i }
      )
    });
  } catch (e: any) {
    console.error("[showcase/recognize] Error global:", e?.message);
    return NextResponse.json({ dishes: [] });
  }
}
