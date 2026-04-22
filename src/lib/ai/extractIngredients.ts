import { prisma } from "@/lib/prisma";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-haiku-4-5-20251001";

interface ExtractionResult {
  dishId: string;
  dishName: string;
  extracted: string[];
  matched: string[];
  created: string[];
  linkedCount: number;
}

export async function extractIngredientsForDish(
  dishId: string,
  dishName: string,
  description: string | null,
  photoUrl: string | null,
): Promise<ExtractionResult> {
  if (!ANTHROPIC_API_KEY) {
    return { dishId, dishName, extracted: [], matched: [], created: [], linkedCount: 0 };
  }

  // Build prompt
  const messages: any[] = [];
  const contentParts: any[] = [];

  if (photoUrl) {
    try {
      const imgRes = await fetch(photoUrl);
      if (imgRes.ok) {
        const buffer = await imgRes.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        const contentType = imgRes.headers.get("content-type") || "image/jpeg";
        contentParts.push({
          type: "image",
          source: { type: "base64", media_type: contentType, data: base64 },
        });
      }
    } catch {}
  }

  contentParts.push({
    type: "text",
    text: `Analyze this dish and extract ALL visible and likely ingredients.

Dish name: "${dishName}"
${description ? `Description: "${description}"` : "No description."}
${photoUrl ? "A photo of the dish is attached." : "No photo available."}

Return ONLY a JSON array of ingredient names in Spanish, lowercase. Include:
- Main proteins (salmón, pollo, tofu, etc.)
- Vegetables and greens
- Sauces and dressings
- Carbs (arroz, pan, etc.)
- Toppings and garnishes
- Any other visible or implied ingredients

Example: ["salmón", "palta", "arroz", "sésamo", "salsa soya", "cebolla morada"]

Return ONLY the JSON array, nothing else.`,
  });

  messages.push({ role: "user", content: contentParts });

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        messages,
      }),
    });

    if (!res.ok) {
      console.error("[extractIngredients] API error:", res.status, await res.text());
      return { dishId, dishName, extracted: [], matched: [], created: [], linkedCount: 0 };
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || "[]";

    // Parse JSON array from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return { dishId, dishName, extracted: [], matched: [], created: [], linkedCount: 0 };
    }

    const ingredients: string[] = JSON.parse(jsonMatch[0])
      .map((i: string) => i.toLowerCase().trim())
      .filter((i: string) => i.length > 1);

    // Match against existing ingredients or create new ones
    const matched: string[] = [];
    const created: string[] = [];
    const ingredientIds: string[] = [];

    for (const name of ingredients) {
      let ingredient = await prisma.ingredient.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
      });

      if (ingredient) {
        matched.push(name);
      } else {
        ingredient = await prisma.ingredient.create({
          data: { name, category: "OTHER" },
        });
        created.push(name);
      }

      ingredientIds.push(ingredient.id);
    }

    // Link ingredients to dish (replace existing)
    await prisma.dishIngredient.deleteMany({ where: { dishId } });
    if (ingredientIds.length > 0) {
      await prisma.dishIngredient.createMany({
        data: ingredientIds.map(ingId => ({ dishId, ingredientId: ingId })),
        skipDuplicates: true,
      });
    }

    // Update the text field too
    await prisma.dish.update({
      where: { id: dishId },
      data: { ingredients: ingredients.join(", ") || null },
    });

    return {
      dishId,
      dishName,
      extracted: ingredients,
      matched,
      created,
      linkedCount: ingredientIds.length,
    };
  } catch (e) {
    console.error("[extractIngredients] Error:", e);
    return { dishId, dishName, extracted: [], matched: [], created: [], linkedCount: 0 };
  }
}
