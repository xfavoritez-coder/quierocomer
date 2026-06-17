import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

type DishInput = {
  id: string;
  name: string;
  description: string | null;
  category: string;
};

export async function POST(req: NextRequest) {
  try {
    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    const body = await req.json();
    const dishes: DishInput[] = body.dishes;

    if (!dishes || dishes.length === 0) {
      return NextResponse.json({ error: "No dishes provided" }, { status: 400 });
    }

    const prompt = `Clasifica cada plato en las siguientes dimensiones. Responde SOLO con JSON válido, sin texto adicional.

OPCIONES VÁLIDAS:
- dishType: tipo específico del plato (ej: hamburguesa, waffle, pasta, ceviche, pizza, tacos, empanada, sándwich, brownie, ensalada, sopa, arroz, pollo, filete, etc.)
- cuisine: array de: [chilena, peruana, italiana, americana, mexicana, japonesa, china, árabe, mediterránea, francesa, asiática, coreana, tailandesa, india, internacional, fusión]
- mealSlot: array de: [desayuno, almuerzo, cena, snack]
- mainIngredient: array de: [carne, pollo, cerdo, cordero, pescado, mariscos, huevo, pasta, arroz, papa, verduras, legumbres, queso, pan, fruta, tofu]
- flavor: array de: [dulce, salado, picante, ácido, cremoso, frito, ahumado, fresco, crujiente, umami]
- format: uno de: [comida_rapida, saludable, comfort, gourmet, antojo, tradicional]
- diet: OMNIVORE (tiene carne/ave/pescado/mariscos), VEGETARIAN (sin carne, con lácteos/huevo), VEGAN (100% vegetal, sin ningún animal)

PLATOS:
${JSON.stringify(dishes, null, 2)}

JSON respuesta (usa los IDs exactos de cada plato):
{
  "id1": { "dishType": "...", "cuisine": [...], "mealSlot": [...], "mainIngredient": [...], "flavor": [...], "format": "...", "diet": "OMNIVORE" },
  ...
}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8000,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[classify] Anthropic error:", err);
      return NextResponse.json({ error: "Error calling Claude API" }, { status: 500 });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text ?? "";

    // Extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[classify] Could not extract JSON from response:", text);
      return NextResponse.json({ error: "Invalid response from Claude" }, { status: 500 });
    }

    const classifications = JSON.parse(jsonMatch[0]);
    return NextResponse.json(classifications);
  } catch (e) {
    console.error("[classify]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
