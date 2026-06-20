import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const maxDuration = 60;

async function urlToBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  return `data:image/webp;base64,${buffer.toString("base64")}`;
}

export async function POST(req: NextRequest) {
  try {
    const { photos } = await req.json() as { photos: string[] };
    if (!photos?.length) return NextResponse.json({ dishes: [] });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ dishes: photos.map((_, i) => ({ name: '', description: null, photoIndex: i })) });
    }

    const openai = new OpenAI({ apiKey });

    const results = await Promise.allSettled(
      photos.map(async (url, i) => {
        try {
          // Convertir a base64 para no depender de que OpenAI pueda fetchear la URL
          const dataUrl = await urlToBase64(url);

          const msg = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            max_tokens: 200,
            messages: [{
              role: "user",
              content: [
                { type: "image_url", image_url: { url: dataUrl, detail: "low" } },
                { type: "text", text: '¿Qué plato aparece en esta foto? Responde SOLO con JSON válido: {"name":"nombre del plato en español","description":"descripción breve o null"}' }
              ]
            }]
          });
          const text = msg.choices[0]?.message?.content ?? "";
          const match = text.match(/\{[\s\S]*?\}/);
          if (!match) return { name: '', description: null, photoIndex: i };
          const parsed = JSON.parse(match[0]);
          return { name: parsed.name || '', description: parsed.description || null, photoIndex: i };
        } catch (e: any) {
          console.error(`[showcase/recognize] foto ${i} error:`, e?.message);
          return { name: '', description: null, photoIndex: i };
        }
      })
    );

    return NextResponse.json({
      dishes: results.map((r, i) =>
        r.status === "fulfilled" ? r.value : { name: '', description: null, photoIndex: i }
      )
    });
  } catch (e: any) {
    console.error("[showcase/recognize] Error global:", e?.message);
    return NextResponse.json({ dishes: [] });
  }
}
