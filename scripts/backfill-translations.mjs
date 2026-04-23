// One-time script: translate all dishes and categories for all active restaurants
// Usage: node scripts/backfill-translations.mjs

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-6";
const TARGET_LANGS = ["en", "pt"];
const LANG_NAMES = { en: "English", pt: "Brazilian Portuguese" };

async function callTranslation(prompt) {
  if (!ANTHROPIC_API_KEY) {
    console.error("Missing ANTHROPIC_API_KEY");
    process.exit(1);
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 512, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) {
    console.error("API error", res.status, await res.text());
    return {};
  }
  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try { return JSON.parse(match[0]); } catch { return {}; }
}

async function translateDish(dish) {
  if (!dish.description) return;

  const existing = await prisma.dishTranslation.findMany({ where: { dishId: dish.id } });
  const langsToTranslate = TARGET_LANGS.filter((lang) => {
    const ex = existing.find((t) => t.lang === lang);
    return !ex || !ex.isManual;
  });
  if (langsToTranslate.length === 0) return;

  const langList = langsToTranslate.map((l) => `"${l}": "${LANG_NAMES[l]}"`).join(", ");
  const prompt = `Translate this restaurant menu dish description from Spanish to the requested languages. Be concise, appetizing, and natural. Do NOT translate the dish name.\n\nDish name (context only): ${dish.name}\nDescription in Spanish: ${dish.description}\n\nReturn ONLY a JSON object with keys: ${langsToTranslate.join(", ")}\nExample: { ${langList.replace(/: "[^"]+"/g, ': "translated text"')} }`;

  const translations = await callTranslation(prompt);
  for (const lang of langsToTranslate) {
    const value = translations[lang];
    if (!value) continue;
    await prisma.dishTranslation.upsert({
      where: { dishId_lang: { dishId: dish.id, lang } },
      create: { dishId: dish.id, lang, description: value, isManual: false },
      update: { description: value, isManual: false },
    });
  }
  console.log(`  ✓ ${dish.name}: ${Object.keys(translations).join(", ")}`);
}

async function translateCategory(cat) {
  const existing = await prisma.categoryTranslation.findMany({ where: { categoryId: cat.id } });
  const langsToTranslate = TARGET_LANGS.filter((lang) => {
    const ex = existing.find((t) => t.lang === lang);
    return !ex || !ex.isManual;
  });
  if (langsToTranslate.length === 0) return;

  const langList = langsToTranslate.map((l) => `"${l}": "${LANG_NAMES[l]}"`).join(", ");
  const prompt = `Translate this restaurant menu category name from Spanish. Be natural and concise.\n\nCategory: ${cat.name}\n\nReturn ONLY a JSON object: { ${langList.replace(/: "[^"]+"/g, ': "translated name"')} }`;

  const translations = await callTranslation(prompt);
  for (const lang of langsToTranslate) {
    const value = translations[lang];
    if (!value) continue;
    await prisma.categoryTranslation.upsert({
      where: { categoryId_lang: { categoryId: cat.id, lang } },
      create: { categoryId: cat.id, lang, name: value, isManual: false },
      update: { name: value, isManual: false },
    });
  }
  console.log(`  ✓ [cat] ${cat.name}: ${Object.keys(translations).join(", ")}`);
}

async function main() {
  const restaurants = await prisma.restaurant.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  console.log(`Found ${restaurants.length} active restaurants\n`);

  for (const rest of restaurants) {
    console.log(`\n=== ${rest.name} ===`);

    const categories = await prisma.category.findMany({
      where: { restaurantId: rest.id, isActive: true },
      select: { id: true, name: true },
    });

    const dishes = await prisma.dish.findMany({
      where: { restaurantId: rest.id, isActive: true, deletedAt: null, description: { not: null } },
      select: { id: true, name: true, description: true },
    });

    console.log(`  ${categories.length} categories, ${dishes.length} dishes with descriptions`);

    // Categories in batches of 3
    for (let i = 0; i < categories.length; i += 3) {
      await Promise.all(categories.slice(i, i + 3).map((c) => translateCategory(c).catch((e) => console.error(`  ✗ [cat] ${c.name}:`, e.message))));
    }

    // Dishes in batches of 3
    for (let i = 0; i < dishes.length; i += 3) {
      await Promise.all(dishes.slice(i, i + 3).map((d) => translateDish(d).catch((e) => console.error(`  ✗ ${d.name}:`, e.message))));
    }
  }

  console.log("\nDone!");
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
