import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import sharp from "sharp";
import { extractJusto } from "./justo";
import { detectDishFlags } from "@/lib/utils/detectDishFlags";
import type { ExtractionResult } from "./types";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function detectDishType(categoryName: string): string {
  const n = categoryName.toLowerCase();
  if (/entrada|compartir|appetizer|starter|antipast|aperitivo|piqueo|snack|para picar|tapas/i.test(n)) return "entry";
  if (/bebida|bebestible|drink|trago|cocktail|cóctel|mocktail|jugo|vino|cerveza|café|coffee|tea|té/i.test(n)) return "drink";
  if (/postre|dessert|dulce|helado|torta|pastel/i.test(n)) return "dessert";
  return "food";
}

async function reuploadPhoto(externalUrl: string, restaurantId: string, dishSlug: string): Promise<string | null> {
  try {
    const res = await fetch(externalUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; QuieroComer/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 500) return null;

    let pipeline = sharp(buffer);
    const meta = await pipeline.metadata();
    if (!meta.format) return null;
    if ((meta.width && meta.width > 800) || (meta.height && meta.height > 800)) {
      pipeline = pipeline.resize(800, 800, { fit: "inside", withoutEnlargement: true });
    }
    const optimized = await pipeline.webp({ quality: 82 }).toBuffer();

    const fileName = `dishes/${restaurantId}-${Date.now()}-${dishSlug.slice(0, 30)}.webp`;
    const { error } = await supabase.storage
      .from("fotos")
      .upload(fileName, optimized, { contentType: "image/webp", upsert: true });

    if (error) return null;

    const { data } = supabase.storage.from("fotos").getPublicUrl(fileName);
    return data.publicUrl;
  } catch {
    return null;
  }
}

/** Extract menu data based on detected provider */
async function extractMenu(cartaUrl: string, providerName: string | null): Promise<ExtractionResult> {
  // Route to the correct extractor
  switch (providerName) {
    case "Justo":
      return extractJusto(cartaUrl);
    // Future: case "Fudo": return extractFudo(cartaUrl);
    // Future: case "Mercat": return extractMercat(cartaUrl);
    // Future: case "Gourmedia": return extractGourmedia(cartaUrl);
    default:
      throw new Error(`No extractor available for provider: ${providerName || "unknown"}`);
  }
}

/**
 * Process a single lead: extract menu data, create Restaurant + Categories + Dishes.
 * Returns the created restaurant slug or throws on failure.
 */
export async function processLead(leadId: string): Promise<{ slug: string; url: string }> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { detectedProvider: { select: { name: true } } },
  });

  if (!lead) throw new Error(`Lead ${leadId} not found`);
  if (!lead.cartaUrl) throw new Error(`Lead ${leadId} has no cartaUrl`);

  // Mark as processing
  await prisma.lead.update({ where: { id: leadId }, data: { cartaStatus: "PROCESSING" } });

  try {
    const providerName = lead.detectedProvider?.name || null;
    const extraction = await extractMenu(lead.cartaUrl, providerName);

    if (extraction.dishes.length === 0) {
      throw new Error("No dishes extracted from the menu");
    }

    // Generate unique slug
    const baseName = lead.localName || extraction.restaurantName;
    let slug = slugify(baseName);
    if (!slug) slug = `local-${Date.now().toString(36)}`;
    const existing = await prisma.restaurant.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    // Create restaurant
    const qrToken = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const restaurant = await prisma.restaurant.create({
      data: {
        name: baseName.split("|")[0].split("-")[0].split("·")[0].split("—")[0].split("Pide")[0].split("Order")[0].trim(),
        slug,
        logoUrl: extraction.logoUrl,
        cartaTheme: "PREMIUM",
        cartaColorMode: "DARK",
        defaultView: "lista",
        isActive: true,
        qrToken,
        qrActivatedAt: new Date(),
        plan: "PREMIUM",
        subscriptionStatus: "NONE",
        waiterPanelActive: true,
        website: lead.cartaUrl,
      },
    });

    // Group dishes by category
    const categoryMap = new Map<string, typeof extraction.dishes>();
    for (const dish of extraction.dishes) {
      const cat = dish.category || "General";
      if (!categoryMap.has(cat)) categoryMap.set(cat, []);
      categoryMap.get(cat)!.push(dish);
    }

    // Create categories and dishes
    const createdDishes: { id: string; name: string; description: string | null; externalPhoto: string | null }[] = [];
    let catPosition = 0;

    for (const [catName, catDishes] of categoryMap) {
      const category = await prisma.category.create({
        data: {
          restaurantId: restaurant.id,
          name: catName,
          position: catPosition++,
          dishType: detectDishType(catName),
          isActive: true,
        },
      });

      const isDrinkCat = category.dishType === "drink" || /caf[eé]|t[eé]\b|infusi[oó]n|bebida|bebestible|jugo|trago/i.test(catName);

      for (let j = 0; j < catDishes.length; j++) {
        const dish = catDishes[j];
        const detected = detectDishFlags({ name: dish.name, description: dish.description, ingredients: "" });

        const created = await prisma.dish.create({
          data: {
            restaurantId: restaurant.id,
            categoryId: category.id,
            name: dish.name.trim(),
            description: dish.description || null,
            price: dish.price,
            photos: [],
            position: j,
            dishDiet: isDrinkCat ? "OMNIVORE" : "OMNIVORE",
            isSpicy: detected.isSpicy,
            containsNuts: isDrinkCat ? false : detected.containsNuts,
            isGlutenFree: isDrinkCat ? false : detected.isGlutenFree,
            isLactoseFree: isDrinkCat ? false : detected.isLactoseFree,
            isSoyFree: isDrinkCat ? false : detected.isSoyFree,
            isActive: true,
          },
        });

        createdDishes.push({
          id: created.id,
          name: created.name,
          description: created.description,
          externalPhoto: dish.imageUrl,
        });
      }
    }

    // Re-upload photos to Supabase in batches
    const dishesWithPhotos = createdDishes.filter((d) => d.externalPhoto);
    if (dishesWithPhotos.length > 0) {
      const BATCH = 10;
      for (let i = 0; i < dishesWithPhotos.length; i += BATCH) {
        const batch = dishesWithPhotos.slice(i, i + BATCH);
        await Promise.allSettled(
          batch.map(async (dish) => {
            const dishSlug = slugify(dish.name);
            const supabaseUrl = await reuploadPhoto(dish.externalPhoto!, restaurant.id, dishSlug);
            const finalUrl = supabaseUrl || dish.externalPhoto!;
            await prisma.dish.update({ where: { id: dish.id }, data: { photos: [finalUrl] } });
          }),
        );
      }
    }

    // Translate dishes in background (fire and forget)
    const dishesWithDesc = createdDishes.filter((d) => d.description);
    if (dishesWithDesc.length > 0) {
      import("@/lib/ai/translateContent")
        .then(({ translateDish }) => {
          (async () => {
            for (let i = 0; i < dishesWithDesc.length; i += 3) {
              const batch = dishesWithDesc.slice(i, i + 3);
              await Promise.all(batch.map((d) => translateDish(d.id).catch(() => {})));
            }
          })();
        })
        .catch(() => {});
    }

    const cartaUrl = `https://quierocomer.cl/qr/${restaurant.slug}?t=${qrToken}`;

    // Mark lead as READY and link to restaurant
    await prisma.lead.update({
      where: { id: leadId },
      data: { cartaStatus: "READY", generatedSlug: restaurant.slug },
    });

    console.log(`[Pipeline] Lead ${leadId} processed: ${restaurant.name} → ${cartaUrl} (${createdDishes.length} dishes)`);

    return { slug: restaurant.slug, url: cartaUrl };
  } catch (error) {
    // Mark as failed (back to PENDING so it can be retried)
    await prisma.lead.update({ where: { id: leadId }, data: { cartaStatus: "PENDING" } });
    throw error;
  }
}
