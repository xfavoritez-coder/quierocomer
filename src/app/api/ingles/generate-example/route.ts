import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { phrase_en, phrase_es } = await req.json();
  if (!phrase_en || !phrase_es) return NextResponse.json({ error: "missing fields" }, { status: 400 });

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

  const text = (msg.content[0] as { type: string; text: string }).text.trim();
  try {
    const json = JSON.parse(text);
    return NextResponse.json(json);
  } catch {
    return NextResponse.json({ error: "parse error", raw: text }, { status: 500 });
  }
}
