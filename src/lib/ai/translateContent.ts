import { prisma } from "@/lib/prisma";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-6";

type Lang = "en" | "pt";
const TARGET_LANGS: Lang[] = ["en", "pt"];

const LANG_NAMES: Record<Lang, string> = { en: "English", pt: "Brazilian Portuguese" };

// ─── Low-level AI call ───────────────────────────────────────────────

async function callTranslation(prompt: string): Promise<Record<string, string>> {
  if (!ANTHROPIC_API_KEY) return {};

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
    return {};
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
    return {};
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

// ─── Modifier group + options translation ──────────────────────────

export async function translateModifierGroup(groupId: string): Promise<void> {
  const group = await prisma.modifierTemplateGroup.findUnique({
    where: { id: groupId },
    include: { translations: true, options: { where: { isHidden: false }, include: { translations: true } } },
  });
  if (!group) return;

  // Collect all names to translate in one call (group name + option names)
  const items: { key: string; value: string }[] = [{ key: "group", value: group.name }];
  for (const opt of group.options) {
    items.push({ key: `opt_${opt.id}`, value: opt.name });
    if (opt.description) items.push({ key: `desc_${opt.id}`, value: opt.description });
  }

  for (const lang of TARGET_LANGS) {
    // Skip if group has manual translation
    const groupTr = group.translations.find(t => t.lang === lang);
    if (groupTr?.isManual) continue;

    // Check which options need translation
    const needsTranslation = !groupTr || group.options.some(o => !o.translations.find(t => t.lang === lang)?.isManual);
    if (!needsTranslation) continue;

    const itemList = items.map(i => `"${i.key}": "${i.value}"`).join(", ");
    const prompt = `Translate these restaurant menu modifier names from Spanish to ${LANG_NAMES[lang]}. Be natural, concise. Keep food terms recognizable.

Items: { ${itemList} }

Return ONLY a JSON object with the same keys and translated values.`;

    const result = await callTranslation(prompt);
    if (!result || Object.keys(result).length === 0) continue;

    // Save group translation
    if (result.group) {
      await prisma.modifierGroupTranslation.upsert({
        where: { groupId_lang: { groupId, lang } },
        create: { groupId, lang, name: result.group, isManual: false },
        update: { name: result.group, isManual: false },
      });
    }

    // Save option translations
    for (const opt of group.options) {
      const translatedName = result[`opt_${opt.id}`];
      if (!translatedName) continue;
      const optTr = opt.translations.find(t => t.lang === lang);
      if (optTr?.isManual) continue;
      await prisma.modifierOptionTranslation.upsert({
        where: { optionId_lang: { optionId: opt.id, lang } },
        create: { optionId: opt.id, lang, name: translatedName, description: result[`desc_${opt.id}`] || null, isManual: false },
        update: { name: translatedName, description: result[`desc_${opt.id}`] || null, isManual: false },
      });
    }
  }
}

export async function translateModifierTemplate(templateId: string): Promise<void> {
  const template = await prisma.modifierTemplate.findUnique({
    where: { id: templateId },
    include: { groups: { select: { id: true } } },
  });
  if (!template) return;
  for (const group of template.groups) {
    await translateModifierGroup(group.id);
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
