import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { photos } = await req.json() as { photos: string[] };
    if (!photos?.length) return NextResponse.json({ dishes: [] });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("[showcase/recognize] ANTHROPIC_API_KEY not set");
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    const client = new Anthropic({ apiKey });

    const results = await Promise.allSettled(
      photos.map(async (url, i) => {
        try {
          const msg = await client.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 200,
            messages: [{
              role: "user",
              content: [
                { type: "image", source: { type: "url", url } },
                { type: "text", text: '¿Qué plato aparece en esta foto? Responde SOLO con JSON válido: {"name":"nombre del plato en español","description":"descripción breve o null"}' }
              ]
            }]
          });

          const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
          const match = text.match(/\{[\s\S]*?\}/);
          if (!match) return { name: "Plato", description: null, photoIndex: i };
          const parsed = JSON.parse(match[0]);
          return { name: parsed.name || "Plato", description: parsed.description || null, photoIndex: i };
        } catch (e: any) {
          console.error(`[showcase/recognize] Error on photo ${i}:`, e?.message);
          return { name: "Plato", description: null, photoIndex: i };
        }
      })
    );

    return NextResponse.json({
      dishes: results.map((r, i) =>
        r.status === "fulfilled" ? r.value : { name: "Plato", description: null, photoIndex: i }
      )
    });
  } catch (e: any) {
    console.error("[showcase/recognize] Fatal error:", e?.message);
    return NextResponse.json({ error: e?.message ?? "Error desconocido" }, { status: 500 });
  }
}
