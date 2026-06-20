import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { photos } = await req.json() as { photos: string[] };
    if (!photos?.length) return NextResponse.json({ dishes: [] });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      // Sin key → devolver nombres vacíos, el usuario los llena
      return NextResponse.json({ dishes: photos.map((_, i) => ({ name: '', description: null, photoIndex: i })) });
    }

    const openai = new OpenAI({ apiKey });

    const results = await Promise.allSettled(
      photos.map(async (url, i) => {
        try {
          const msg = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            max_tokens: 200,
            messages: [{
              role: "user",
              content: [
                { type: "image_url", image_url: { url, detail: "low" } },
                { type: "text", text: '¿Qué plato aparece en esta foto? Responde SOLO con JSON válido: {"name":"nombre del plato en español","description":"descripción breve o null"}' }
              ]
            }]
          });
          const text = msg.choices[0]?.message?.content ?? "";
          const match = text.match(/\{[\s\S]*?\}/);
          if (!match) return { name: '', description: null, photoIndex: i };
          const parsed = JSON.parse(match[0]);
          return { name: parsed.name || '', description: parsed.description || null, photoIndex: i };
        } catch {
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
    console.error("[showcase/recognize] Error:", e?.message);
    // En vez de 500, devolver nombres vacíos para que el flujo continue
    return NextResponse.json({ dishes: [] });
  }
}
