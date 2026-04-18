/**
 * Enrich dishes with ingredients and allergens using Claude.
 * Analyzes dish names/descriptions and infers:
 * - Main ingredients
 * - Allergens (gluten, lactose, nuts, shellfish, soy, etc)
 * - Diet compatibility (vegan, vegetarian, etc)
 *
 * Usage: node scripts/enrich-dishes.js [restaurant-slug]
 * Example: node scripts/enrich-dishes.js horusvegan
 */

require("dotenv").config({ path: ".env.local" });
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const BATCH_SIZE = 15; // dishes per Claude call

async function enrichDishes(slug) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { console.error("ANTHROPIC_API_KEY not set"); process.exit(1); }

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (!restaurant) { console.error(`Restaurant "${slug}" not found`); process.exit(1); }

  const dishes = await prisma.dish.findMany({
    where: { restaurantId: restaurant.id, isActive: true },
    include: { category: { select: { name: true } } },
    orderBy: { position: "asc" },
  });

  console.log(`\n🧞 Analizando ${dishes.length} platos de "${restaurant.name}"...\n`);

  // Process in batches
  for (let i = 0; i < dishes.length; i += BATCH_SIZE) {
    const batch = dishes.slice(i, i + BATCH_SIZE);
    const dishList = batch.map(d =>
      `ID: ${d.id} | Nombre: ${d.name} | Categoría: ${d.category.name}${d.description ? ` | Descripción: ${d.description}` : ""}${d.ingredients ? ` | Ingredientes actuales: ${d.ingredients}` : ""}`
    ).join("\n");

    const prompt = `Eres un chef experto. Analiza estos platos de "${restaurant.name}" y para cada uno infiere:
1. Ingredientes principales (separados por coma)
2. Alérgenos presentes (de esta lista: gluten, lactosa, frutos secos, maní, mariscos, soja, huevo, apio, mostaza, sésamo, ninguno)
3. Si es picante o no

PLATOS:
${dishList}

REGLAS:
- "${restaurant.name}" ${slug.includes("vegan") ? "es un restaurante VEGANO, todos los platos son veganos (sin lácteos, sin huevo, sin miel)" : "puede tener platos de todo tipo"}
- Sé conservador con los alérgenos: si un plato probablemente tiene gluten (pan, masa, tempura, rebozado), márcalo
- El sushi y rolls generalmente tienen soja (salsa de soja)
- Tempura y furai = gluten
- Mozzarella y queso = lactosa (excepto en restaurantes veganos donde es vegano)

Responde SOLO con JSON array, sin markdown:
[{
  "id": "dish-id",
  "ingredients": "ingrediente1, ingrediente2, ingrediente3",
  "allergens": "gluten, soja",
  "isSpicy": false
}]`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 3000, messages: [{ role: "user", content: prompt }] }),
      });

      if (!res.ok) { console.error(`Claude error: ${res.status}`); continue; }

      const data = await res.json();
      const text = data.content?.[0]?.text || "[]";
      const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const results = JSON.parse(cleaned);

      for (const r of results) {
        const dish = batch.find(d => d.id === r.id);
        if (!dish) continue;

        await prisma.dish.update({
          where: { id: r.id },
          data: {
            ingredients: r.ingredients || dish.ingredients,
            allergens: r.allergens || dish.allergens,
          },
        });

        const icon = r.isSpicy ? "🌶️" : "✅";
        console.log(`  ${icon} ${dish.name}`);
        console.log(`     Ingredientes: ${r.ingredients}`);
        console.log(`     Alérgenos: ${r.allergens || "ninguno"}`);
      }
    } catch (e) {
      console.error(`Error processing batch ${i}-${i + BATCH_SIZE}:`, e.message);
    }
  }

  console.log(`\n✅ Listo. ${dishes.length} platos enriquecidos.\n`);
  await prisma.$disconnect();
}

const slug = process.argv[2];
if (!slug) {
  console.log("Uso: node scripts/enrich-dishes.js [slug]");
  console.log("Ejemplo: node scripts/enrich-dishes.js horusvegan");
  process.exit(1);
}

enrichDishes(slug).catch(e => { console.error(e); process.exit(1); });
