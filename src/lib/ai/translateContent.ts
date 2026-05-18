import { prisma } from "@/lib/prisma";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-6";

type Lang = "en" | "pt";
const TARGET_LANGS: Lang[] = ["en", "pt"];

const LANG_NAMES: Record<Lang, string> = { en: "English", pt: "Brazilian Portuguese" };

// ─── Low-level AI call ───────────────────────────────────────────────

const MAX_RETRIES = 3;

async function callTranslation(prompt: string, attempt = 1, maxTokens = 512): Promise<Record<string, any>> {
  if (!ANTHROPIC_API_KEY) {
    console.error("[translate] Missing ANTHROPIC_API_KEY");
    return {};
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(maxTokens > 512 ? 45000 : 20000),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[translate] API error ${res.status} (attempt ${attempt}/${MAX_RETRIES})`, body);
      if (attempt < MAX_RETRIES && (res.status >= 429 || res.status >= 500)) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
        return callTranslation(prompt, attempt + 1, maxTokens);
      }
      return {};
    }

    const data = await res.json();
    const text: string = data.content?.[0]?.text || "";

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return {};

    try {
      return JSON.parse(match[0]);
    } catch {
      console.error("[translate] JSON parse error", text);
      return {};
    }
  } catch (err: any) {
    console.error(`[translate] Fetch error (attempt ${attempt}/${MAX_RETRIES}):`, err?.message);
    if (attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, 1000 * attempt));
      return callTranslation(prompt, attempt + 1, maxTokens);
    }
    return {};
  }
}

// ─── Dish description translation ────────────────────────────────────

export async function translateDish(dishId: string): Promise<void> {
  const dish = await prisma.dish.findUnique({
    where: { id: dishId },
    select: { name: true, description: true, translations: true },
  });

  if (!dish) return;

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
  const hasDesc = !!dish.description;

  const prompt = `Translate this restaurant menu dish from Spanish to the requested languages. Be concise, appetizing, and natural.

IMPORTANT for dish names:
- Keep proper nouns, Italian/French/Japanese culinary names unchanged (e.g. "Margherita", "Bruschetta", "Carpaccio", "Ramen", "Croissant")
- Only translate names that are descriptive in Spanish (e.g. "Ensalada de la casa" → "House salad")
- If the name is already a universal culinary term, return it as-is

Dish name: ${dish.name}${hasDesc ? `\nDescription: ${dish.description}` : ""}

Return ONLY a JSON object with these keys: ${langsToTranslate.map(l => `"${l}_name", ${hasDesc ? `"${l}_desc", ` : ""}`).join("")}
Example: { ${langsToTranslate.map(l => `"${l}_name": "translated or original name"${hasDesc ? `, "${l}_desc": "translated description"` : ""}`).join(", ")} }`;

  const translations = await callTranslation(prompt);

  // Upsert each translation
  for (const lang of langsToTranslate) {
    const name = translations[`${lang}_name`];
    const description = translations[`${lang}_desc`] || null;
    if (!name && !description) continue;
    await prisma.dishTranslation.upsert({
      where: { dishId_lang: { dishId, lang } },
      create: { dishId, lang, name: name || null, description, isManual: false },
      update: { ...(name ? { name } : {}), ...(description ? { description } : {}), isManual: false },
    });
  }
}

// ─── Bulk dish translation (many dishes per API call) ────────────────

interface DishInput { id: string; name: string; description: string | null }

/**
 * Translate up to ~15 dishes in a single API call per language.
 * Returns how many dishes were successfully translated.
 */
export async function translateDishBulk(dishes: DishInput[]): Promise<number> {
  if (dishes.length === 0) return 0;

  // Build numbered list for the prompt
  const dishList = dishes.map((d, i) => {
    const line = `${i}: ${d.name}`;
    return d.description ? `${line} | ${d.description}` : line;
  }).join("\n");

  const hasAnyDesc = dishes.some(d => !!d.description);

  let translated = 0;

  for (const lang of TARGET_LANGS) {
    const prompt = `Translate these restaurant menu dishes from Spanish to ${LANG_NAMES[lang]}. Be concise, appetizing, and natural.

IMPORTANT for dish names:
- Keep proper nouns, Italian/French/Japanese culinary names unchanged (e.g. "Margherita", "Bruschetta", "Carpaccio", "Ramen", "Croissant")
- Only translate names that are descriptive in Spanish (e.g. "Ensalada de la casa" → "House salad")
- If the name is already a universal culinary term, return it as-is

Dishes (index: name${hasAnyDesc ? " | description" : ""}):
${dishList}

Return ONLY a JSON object where keys are the index numbers. Each value is an object with "name"${hasAnyDesc ? ' and optionally "desc"' : ""}:
{ "0": { "name": "translated" }, "1": { "name": "translated"${hasAnyDesc ? ', "desc": "translated"' : ""} }, ... }`;

    const result = await callTranslation(prompt, 1, 2048);
    if (!result || Object.keys(result).length === 0) continue;

    for (let i = 0; i < dishes.length; i++) {
      const entry = result[String(i)];
      if (!entry || typeof entry !== "object") continue;
      const name = (entry as any).name as string | undefined;
      const desc = (entry as any).desc as string | undefined;
      if (!name && !desc) continue;

      await prisma.dishTranslation.upsert({
        where: { dishId_lang: { dishId: dishes[i].id, lang } },
        create: { dishId: dishes[i].id, lang, name: name || null, description: desc || null, isManual: false },
        update: { ...(name ? { name } : {}), ...(desc ? { description: desc } : {}), isManual: false },
      });
      if (lang === TARGET_LANGS[0]) translated++;
    }
  }

  return translated;
}

// ─── Bulk category translation (many categories per API call) ────────

export async function translateCategoryBulk(categories: { id: string; name: string }[]): Promise<void> {
  if (categories.length === 0) return;

  const catList = categories.map((c, i) => `${i}: ${c.name}`).join("\n");

  for (const lang of TARGET_LANGS) {
    const prompt = `Translate these restaurant menu category names from Spanish to ${LANG_NAMES[lang]}. Be natural and concise.

Categories (index: name):
${catList}

Return ONLY a JSON object where keys are index numbers and values are the translated names:
{ "0": "translated", "1": "translated", ... }`;

    const result = await callTranslation(prompt);
    if (!result || Object.keys(result).length === 0) continue;

    for (let i = 0; i < categories.length; i++) {
      const value = result[String(i)];
      if (!value || typeof value !== "string") continue;
      await prisma.categoryTranslation.upsert({
        where: { categoryId_lang: { categoryId: categories[i].id, lang } },
        create: { categoryId: categories[i].id, lang, name: value, isManual: false },
        update: { name: value, isManual: false },
      });
    }
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
      where: { restaurantId, isActive: true, deletedAt: null },
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
