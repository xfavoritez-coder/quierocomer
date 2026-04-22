import { prisma } from "@/lib/prisma";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-6";

interface ExtractionResult {
  dishId: string;
  dishName: string;
  matched: string[];      // ingredientes que ya existían y fueron vinculados
  suggested: string[];    // ingredientes nuevos que la IA detectó pero NO creó
  linkedCount: number;
}

export async function extractIngredientsForDish(
  dishId: string,
  dishName: string,
  description: string | null,
  photoUrl: string | null,
): Promise<ExtractionResult> {
  if (!ANTHROPIC_API_KEY) {
    return { dishId, dishName, matched: [], suggested: [], linkedCount: 0 };
  }

  // Get existing master ingredient list with aliases + ignored list
  const existing = await prisma.ingredient.findMany({
    select: { id: true, name: true, aliases: true },
    orderBy: { name: "asc" },
  });
  const existingNames = existing.map(i => i.name);
  const ignored = await prisma.ignoredIngredient.findMany({ select: { name: true } });
  const ignoredNames = new Set(ignored.map(i => i.name.toLowerCase()));

  // Build prompt
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
    text: `Analyze this dish and identify its ingredients.

Dish name: "${dishName}"
${description ? `Description: "${description}"` : "No description."}
${photoUrl ? "A photo of the dish is attached." : "No photo available."}

EXISTING INGREDIENTS DATABASE (use these names EXACTLY when possible):
${existingNames.length > 0 ? existingNames.join(", ") : "(empty - no ingredients yet)"}

Rules:
1. If an ingredient matches one from the existing list, use the EXACT name from the list (e.g., if "cebollín" exists, don't say "cebollino" or "cebolleta")
2. If an ingredient is NOT in the existing list, still include it but I'll handle it separately
3. Use simple, common names in Spanish (e.g., "salmón" not "salmón atlántico fresco")
4. Don't include generic terms like "salsa estilo ceviche" — break it down into actual ingredients if possible, or use a simple name like "leche de tigre"
5. Don't include cooking methods or preparations as ingredients

Return a JSON object:
{
  "matched": ["ingrediente1", "ingrediente2"],
  "new": ["ingrediente3", "ingrediente4"]
}

"matched" = ingredients that exist in the database (use exact names)
"new" = ingredients NOT in the database

Return ONLY the JSON object, nothing else.`,
  });

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
        messages: [{ role: "user", content: contentParts }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[extractIngredients] ${dishName}: API error ${res.status}:`, errText.substring(0, 200));
      return { dishId, dishName, matched: [], suggested: [], linkedCount: 0 };
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || "{}";
    console.log(`[extractIngredients] ${dishName}: AI response:`, text.substring(0, 200));

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log(`[extractIngredients] ${dishName}: No JSON found in response`);

      return { dishId, dishName, matched: [], suggested: [], linkedCount: 0 };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const matchedNames: string[] = (parsed.matched || []).map((i: string) => i.toLowerCase().trim()).filter((i: string) => i.length > 1);
    const suggestedNames: string[] = (parsed.new || []).map((i: string) => i.toLowerCase().trim()).filter((i: string) => i.length > 1);

    // Link matched ingredients to dish
    const ingredientIds: string[] = [];
    const actualMatched: string[] = [];

    // Helper: find ingredient by name or alias
    const findByNameOrAlias = (name: string) => {
      const lower = name.toLowerCase();
      return existing.find(e =>
        e.name.toLowerCase() === lower ||
        e.aliases.some(a => a.toLowerCase() === lower)
      );
    };

    for (const name of matchedNames) {
      const ingredient = findByNameOrAlias(name);
      if (ingredient) {
        ingredientIds.push(ingredient.id);
        actualMatched.push(ingredient.name); // use canonical name, not alias
      } else {
        suggestedNames.push(name);
      }
    }

    // Also check suggestions against aliases (IA might not know they exist)
    const remainingSuggestions: string[] = [];
    for (const name of suggestedNames) {
      const ingredient = findByNameOrAlias(name);
      if (ingredient) {
        ingredientIds.push(ingredient.id);
        actualMatched.push(ingredient.name);
      } else {
        remainingSuggestions.push(name);
      }
    }

    // Replace dish ingredient links
    await prisma.dishIngredient.deleteMany({ where: { dishId } });
    if (ingredientIds.length > 0) {
      await prisma.dishIngredient.createMany({
        data: ingredientIds.map(ingId => ({ dishId, ingredientId: ingId })),
        skipDuplicates: true,
      });
    }

    // Update text field with matched ingredients only
    await prisma.dish.update({
      where: { id: dishId },
      data: { ingredients: actualMatched.join(", ") || null },
    });

    // Filter out ignored ingredients from suggestions
    const filteredSuggestions = [...new Set(remainingSuggestions)].filter(s => !ignoredNames.has(s.toLowerCase()));

    return {
      dishId,
      dishName,
      matched: [...new Set(actualMatched)],
      suggested: filteredSuggestions,
      linkedCount: ingredientIds.length,
      detectedDiet,
    };
  } catch (e) {
    console.error("[extractIngredients] Error:", e);
    return { dishId, dishName, matched: [], suggested: [], linkedCount: 0 };
  }
}
