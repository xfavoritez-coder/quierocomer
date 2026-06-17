import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: NextRequest) {
  const { photos } = await req.json() as { photos: string[] };
  if (!photos?.length) return NextResponse.json({ dishes: [] });

  const dishes = await Promise.allSettled(
    photos.map(async (url, i) => {
      const msg = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 200,
        messages: [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url, detail: "low" } },
            { type: "text", text: '¿Qué plato aparece en esta foto? Responde SOLO con JSON: {"name":"nombre del plato en español","description":"descripción breve o null"}' }
          ]
        }]
      });

      const text = msg.choices[0]?.message?.content ?? "";
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return { name: "Plato", description: null, photoIndex: i };
      const parsed = JSON.parse(match[0]);
      return { name: parsed.name || "Plato", description: parsed.description || null, photoIndex: i };
    })
  );

  return NextResponse.json({
    dishes: dishes.map((r, i) =>
      r.status === "fulfilled" ? r.value : { name: "Plato", description: null, photoIndex: i }
    )
  });
}
