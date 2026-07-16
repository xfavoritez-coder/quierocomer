import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  try {
    const { phrase_en, phrase_es } = await req.json();
    if (!phrase_en || !phrase_es) return NextResponse.json({ error: "missing fields" }, { status: 400 });

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `You are helping build an English learning app for a Spanish speaker.

English expression: "${phrase_en}"
Spanish meaning: "${phrase_es}"

Write ONE short, natural example sentence in English that uses this expression in a real everyday context (under 12 words). Then write its natural Spanish translation.

Rules:
- The sentence must clearly use the exact expression "${phrase_en}"
- Keep it simple and very common in daily conversation
- No forced or weird contexts
- Spanish translation must be natural, not literal

Respond in this exact JSON format (no extra text):
{"example_en": "...", "example_es": "..."}`,
        },
      ],
    });

    const raw = (msg.content[0] as { type: string; text: string }).text;
    const match = raw.match(/\{[\s\S]*?\}/);
    if (match) {
      try {
        return NextResponse.json(JSON.parse(match[0]));
      } catch { /* fall through */ }
    }
    return NextResponse.json({ error: "parse error", raw }, { status: 500 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
