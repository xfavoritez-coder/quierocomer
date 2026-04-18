/**
 * Seed the master Ingredient table with common ingredients,
 * then link existing dish text ingredients to the table.
 *
 * Usage: node scripts/seed-ingredients.js
 */
require("dotenv").config({ path: ".env.local" });
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const MASTER_INGREDIENTS = [
  // Proteins
  { name: "pollo", category: "PROTEIN" },
  { name: "salmón", category: "PROTEIN" },
  { name: "atún", category: "PROTEIN" },
  { name: "camarón", category: "PROTEIN" },
  { name: "carne", category: "PROTEIN" },
  { name: "cerdo", category: "PROTEIN" },
  { name: "tofu", category: "PROTEIN" },
  { name: "seitán", category: "PROTEIN" },
  { name: "huevo", category: "PROTEIN", isAllergen: true, allergenType: "huevo" },
  // Vegetables
  { name: "palta", category: "VEGETABLE" },
  { name: "pepino", category: "VEGETABLE" },
  { name: "cebolla", category: "VEGETABLE" },
  { name: "tomate", category: "VEGETABLE" },
  { name: "lechuga", category: "VEGETABLE" },
  { name: "champiñón", category: "VEGETABLE" },
  { name: "espárrago", category: "VEGETABLE" },
  { name: "brócoli", category: "VEGETABLE" },
  { name: "zanahoria", category: "VEGETABLE" },
  { name: "cilantro", category: "VEGETABLE" },
  { name: "edamame", category: "VEGETABLE" },
  { name: "pak choi", category: "VEGETABLE" },
  { name: "espinaca", category: "VEGETABLE" },
  // Fruits
  { name: "mango", category: "FRUIT" },
  { name: "limón", category: "FRUIT" },
  { name: "maracuyá", category: "FRUIT" },
  { name: "naranja", category: "FRUIT" },
  { name: "piña", category: "FRUIT" },
  { name: "frutilla", category: "FRUIT" },
  // Dairy
  { name: "queso", category: "DAIRY", isAllergen: true, allergenType: "lactosa" },
  { name: "queso crema", category: "DAIRY", isAllergen: true, allergenType: "lactosa" },
  { name: "mozzarella", category: "DAIRY", isAllergen: true, allergenType: "lactosa" },
  { name: "queso vegano", category: "DAIRY" },
  { name: "leche de coco", category: "DAIRY" },
  { name: "leche de avena", category: "DAIRY" },
  // Carbs
  { name: "arroz", category: "CARB" },
  { name: "arroz integral", category: "CARB" },
  { name: "fideos", category: "CARB", isAllergen: true, allergenType: "gluten" },
  { name: "pan", category: "CARB", isAllergen: true, allergenType: "gluten" },
  { name: "masa", category: "CARB", isAllergen: true, allergenType: "gluten" },
  { name: "nori", category: "CARB" },
  { name: "quinoa", category: "CARB" },
  { name: "papa", category: "CARB" },
  // Sauces
  { name: "salsa de soja", category: "SAUCE", isAllergen: true, allergenType: "soja" },
  { name: "salsa teriyaki", category: "SAUCE", isAllergen: true, allergenType: "soja" },
  { name: "salsa ponzu", category: "SAUCE", isAllergen: true, allergenType: "soja" },
  { name: "mayonesa", category: "SAUCE", isAllergen: true, allergenType: "huevo" },
  { name: "mayonesa vegana", category: "SAUCE" },
  { name: "chimichurri", category: "SAUCE" },
  { name: "pesto", category: "SAUCE" },
  { name: "guacamole", category: "SAUCE" },
  { name: "salsa buffalo", category: "SAUCE" },
  { name: "salsa bbq", category: "SAUCE" },
  { name: "salsa chipotle", category: "SAUCE" },
  { name: "sweet chili", category: "SAUCE" },
  // Spices
  { name: "jengibre", category: "SPICE" },
  { name: "ajo", category: "SPICE" },
  { name: "curry", category: "SPICE" },
  { name: "wasabi", category: "SPICE" },
  { name: "sésamo", category: "SPICE", isAllergen: true, allergenType: "sésamo" },
  { name: "trufa", category: "SPICE" },
  // Other
  { name: "tempura", category: "OTHER", isAllergen: true, allergenType: "gluten" },
  { name: "panko", category: "OTHER", isAllergen: true, allergenType: "gluten" },
  { name: "almendras", category: "OTHER", isAllergen: true, allergenType: "frutos secos" },
  { name: "maní", category: "OTHER", isAllergen: true, allergenType: "maní" },
  { name: "nueces", category: "OTHER", isAllergen: true, allergenType: "frutos secos" },
  { name: "anacardos", category: "OTHER", isAllergen: true, allergenType: "frutos secos" },
  { name: "chocolate", category: "OTHER" },
  { name: "cacao", category: "OTHER" },
  { name: "café", category: "OTHER" },
  { name: "matcha", category: "OTHER" },
  { name: "miso", category: "OTHER", isAllergen: true, allergenType: "soja" },
];

async function main() {
  console.log("🌱 Seeding master ingredients...\n");

  let created = 0;
  let existing = 0;

  for (const ing of MASTER_INGREDIENTS) {
    try {
      await prisma.ingredient.upsert({
        where: { name: ing.name },
        update: { isAllergen: ing.isAllergen || false, allergenType: ing.allergenType || null },
        create: { name: ing.name, category: ing.category, isAllergen: ing.isAllergen || false, allergenType: ing.allergenType || null },
      });
      created++;
    } catch {
      existing++;
    }
  }

  console.log(`✅ ${created} ingredientes en tabla maestra (${existing} ya existían)\n`);

  // Now link existing dish text ingredients to the table
  console.log("🔗 Vinculando ingredientes de platos existentes...\n");

  const dishes = await prisma.dish.findMany({
    where: { ingredients: { not: null } },
    select: { id: true, name: true, ingredients: true },
  });

  const allIngredients = await prisma.ingredient.findMany({ select: { id: true, name: true } });
  const ingMap = new Map(allIngredients.map(i => [i.name.toLowerCase(), i.id]));

  let linked = 0;
  for (const dish of dishes) {
    const parts = (dish.ingredients || "").toLowerCase().split(/[,;]+/).map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
      // Try exact match first, then partial
      let ingId = ingMap.get(part);
      if (!ingId) {
        for (const [name, id] of ingMap) {
          if (part.includes(name) || name.includes(part)) { ingId = id; break; }
        }
      }
      if (ingId) {
        try {
          await prisma.dishIngredient.create({ data: { dishId: dish.id, ingredientId: ingId } });
          linked++;
        } catch {} // unique constraint = already linked
      }
    }
  }

  console.log(`✅ ${linked} vínculos creados\n`);

  // Set dishDiet based on allergens
  console.log("🥗 Configurando tipo de dieta por plato...\n");
  const allDishes = await prisma.dish.findMany({
    select: { id: true, allergens: true, ingredients: true, restaurant: { select: { slug: true } } },
  });

  let dietSet = 0;
  for (const d of allDishes) {
    const text = ((d.allergens || "") + " " + (d.ingredients || "")).toLowerCase();
    const slug = d.restaurant.slug;
    let diet = "OMNIVORE";

    if (slug.includes("vegan") || slug.includes("horus")) {
      diet = "VEGAN";
    } else if (!text.includes("lactosa") && !text.includes("huevo") && !text.includes("carne") && !text.includes("pollo") && !text.includes("cerdo") && !text.includes("salmón") && !text.includes("camarón") && !text.includes("atún") && !text.includes("mariscos")) {
      if (text.includes("queso") || text.includes("mozzarella") || text.includes("crema")) {
        diet = "VEGETARIAN";
      }
    } else if (!text.includes("carne") && !text.includes("pollo") && !text.includes("cerdo")) {
      if (text.includes("salmón") || text.includes("camarón") || text.includes("atún") || text.includes("mariscos")) {
        diet = "PESCETARIAN";
      }
    }

    // Detect spicy
    const isSpicy = text.includes("picante") || text.includes("spicy") || text.includes("chili") || text.includes("buffalo") || text.includes("chipotle");

    await prisma.dish.update({ where: { id: d.id }, data: { dishDiet: diet, isSpicy } });
    dietSet++;
  }

  console.log(`✅ ${dietSet} platos con dieta y picante configurados\n`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
