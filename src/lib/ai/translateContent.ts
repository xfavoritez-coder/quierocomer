import { prisma } from "@/lib/prisma";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-6";

type Lang = "en" | "pt";
const TARGET_LANGS: Lang[] = ["en", "pt"];

const LANG_NAMES: Record<Lang, string> = { en: "English", pt: "Brazilian Portuguese" };

// ─── Low-level AI call ───────────────────────────────────────────────

async function callTranslation(prompt: string): Promise<Record<Lang, string>> {
  if (!ANTHROPIC_API_KEY) return {} as Record<Lang, string>;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    console.error("[translate] API error", res.status, await res.text());
    return {} as Record<Lang, string>;
  }

  const data = await res.json();
  const text: string = data.content?.[0]?.text || "";

  // Extract JSON from response
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return {} as Record<Lang, string>;

  try {
    return JSON.parse(match[0]);
  } catch {
    console.error("[translate] JSON parse error", text);
    return {} as Record<Lang, string>;
  }
}

// ─── Dish description translation ────────────────────────────────────

export async function translateDish(dishId: string): Promise<void> {
  const dish = await prisma.dish.findUnique({
    where: { id: dishId },
    select: { name: true, description: true, translations: true },
  });

  if (!dish?.description) return;

  // Figure out which langs need (re)translation
  const langsToTranslate: Lang[] = [];
  for (const lang of TARGET_LANGS) {
    const existing = dish.translations.find((t) => t.lang === lang);
    if (!existing || !existing.isManual) {
      langsToTranslate.push(lang);
    }
  }

  if (langsToTranslate.length === 0) return;

  const langList = langsToTranslate.map((l) => `"${l}": "${LANG_NAMES[l]}"`).join(", ");
  const prompt = `Translate this restaurant menu dish description from Spanish to the requested languages. Be concise, appetizing, and natural. Do NOT translate the dish name.

Dish name (context only): ${dish.name}
Description in Spanish: ${dish.description}

Return ONLY a JSON object with these keys: ${langsToTranslate.join(", ")}
Example format: { ${langList.replace(/: "[^"]+"/g, ': "translated text"')} }`;

  const translations = await callTranslation(prompt);

  // Upsert each translation
  for (const lang of langsToTranslate) {
    const value = translations[lang];
    if (!value) continue;
    await prisma.dishTranslation.upsert({
      where: { dishId_lang: { dishId, lang } },
      create: { dishId, lang, description: value, isManual: false },
      update: { description: value, isManual: false },
    });
  }
}

// ─── Category name translation ───────────────────────────────────────

export async function translateCategory(categoryId: string): Promise<void> {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { name: true, translations: true },
  });

  if (!category) return;

  const langsToTranslate: Lang[] = [];
  for (const lang of TARGET_LANGS) {
    const existing = category.translations.find((t) => t.lang === lang);
    if (!existing || !existing.isManual) {
      langsToTranslate.push(lang);
    }
  }

  if (langsToTranslate.length === 0) return;

  const langList = langsToTranslate.map((l) => `"${l}": "${LANG_NAMES[l]}"`).join(", ");
  const prompt = `Translate this restaurant menu category name from Spanish. Be natural and concise.

Category: ${category.name}

Return ONLY a JSON object: { ${langList.replace(/: "[^"]+"/g, ': "translated name"')} }`;

  const translations = await callTranslation(prompt);

  for (const lang of langsToTranslate) {
    const value = translations[lang];
    if (!value) continue;
    await prisma.categoryTranslation.upsert({
      where: { categoryId_lang: { categoryId, lang } },
      create: { categoryId, lang, name: value, isManual: false },
      update: { name: value, isManual: false },
    });
  }
}

// ─── Bulk translation (for backfill) ────────────────────────────────

export async function translateAllForRestaurant(restaurantId: string): Promise<{
  dishes: number;
  categories: number;
}> {
  const [dishes, categories] = await Promise.all([
    prisma.dish.findMany({
      where: { restaurantId, isActive: true, deletedAt: null, description: { not: null } },
      select: { id: true },
    }),
    prisma.category.findMany({
      where: { restaurantId, isActive: true },
      select: { id: true },
    }),
  ]);

  let dishCount = 0;
  let catCount = 0;

  // Translate in batches of 3 to avoid rate limits
  for (let i = 0; i < dishes.length; i += 3) {
    const batch = dishes.slice(i, i + 3);
    await Promise.all(batch.map((d) => translateDish(d.id).catch(console.error)));
    dishCount += batch.length;
  }

  for (let i = 0; i < categories.length; i += 3) {
    const batch = categories.slice(i, i + 3);
    await Promise.all(batch.map((c) => translateCategory(c.id).catch(console.error)));
    catCount += batch.length;
  }

  return { dishes: dishCount, categories: catCount };
}
