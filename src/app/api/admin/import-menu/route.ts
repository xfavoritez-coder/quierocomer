import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import { extractWithScraper } from "@/lib/extractors/scrape";
import { extractFromDocument } from "@/lib/extractors/document";
import { extractGoogleDrive } from "@/lib/extractors/googledrive";
import { detectDishFlags } from "@/lib/utils/detectDishFlags";
import type { ExtractionResult } from "@/lib/extractors/types";

export const maxDuration = 300;

/**
 * Detects bulk/wholesale products that aren't individual menu dishes.
 * e.g. "Ravioli de Ricotta 48 Un", "Bandeja de 24 unidades"
 */
function isBulkProduct(name: string, description?: string | null): boolean {
  const text = `${name} ${description || ""}`;
  // Match: "48 un", "24 und", "100 unidades", "x48", "pack de 24", "caja de 12"
  return /\b\d{2,}\s*(un|und|unid|unidades?)\b/i.test(text) ||
    /\b(pack|caja|paquete|bolsa|bandeja)\s+de\s+\d+/i.test(text);
}

function detectDishType(categoryName: string): string {
  const n = categoryName.toLowerCase();
  if (/entrada|compartir|appetizer|starter|antipast|aperitivo|piqueo|snack|para picar|tapas/i.test(n)) return "entry";
  if (/bebida|bebestible|drink|trago|cocktail|cóctel|mocktail|jugo|vino|cerveza|café|coffee|tea|té/i.test(n)) return "drink";
  if (/postre|dessert|dulce|helado|torta|pastel/i.test(n)) return "dessert";
  return "food";
}

/**
 * POST /api/admin/import-menu
 * Import menu from link or uploaded file, replacing existing dishes.
 * Body: { restaurantId, cartaUrl } for links
 * FormData: { restaurantId, file } for uploads
 */
export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";

  let restaurantId: string = "";
  let extraction: ExtractionResult;

  try {

  if (contentType.includes("multipart/form-data")) {
    // File upload (single or multiple) — legacy path
    const formData = await req.formData();
    restaurantId = formData.get("restaurantId") as string;
    const files = formData.getAll("file") as File[];

    if (!restaurantId || !files.length) {
      return NextResponse.json({ error: "Falta restaurantId o archivo" }, { status: 400 });
    }

    const allDishes: ExtractionResult["dishes"] = [];
    let mergedLogoUrl: string | undefined;
    let mergedRestaurantName: string | undefined;

    for (const file of files.slice(0, 10)) {
      const ext = file.name.split(".").pop() || "bin";
      const fileName = `cartas/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      const { error: uploadError } = await supabase.storage
        .from("fotos")
        .upload(fileName, buffer, { contentType: file.type, upsert: true });
      if (uploadError) continue;
      const { data: urlData } = supabase.storage.from("fotos").getPublicUrl(fileName);
      const result = await extractFromDocument(urlData.publicUrl);
      allDishes.push(...result.dishes);
      if (!mergedLogoUrl && result.logoUrl) mergedLogoUrl = result.logoUrl;
      if (!mergedRestaurantName && result.restaurantName) mergedRestaurantName = result.restaurantName;
    }

    extraction = { dishes: allDishes, logoUrl: mergedLogoUrl ?? null, bannerUrl: null, restaurantName: mergedRestaurantName ?? "" };
  } else {
    // JSON body — link mode or pre-uploaded URLs
    const body = await req.json();
    restaurantId = body.restaurantId;

    // New: array of pre-uploaded photo URLs
    if (Array.isArray(body.urls) && body.urls.length > 0) {
      const allDishes: ExtractionResult["dishes"] = [];
      let mergedLogoUrl: string | undefined;
      let mergedRestaurantName: string | undefined;
      for (const url of body.urls.slice(0, 10)) {
        const result = await extractFromDocument(url);
        allDishes.push(...result.dishes);
        if (!mergedLogoUrl && result.logoUrl) mergedLogoUrl = result.logoUrl;
        if (!mergedRestaurantName && result.restaurantName) mergedRestaurantName = result.restaurantName;
      }
      extraction = { dishes: allDishes, logoUrl: mergedLogoUrl ?? null, bannerUrl: null, restaurantName: mergedRestaurantName ?? "" };
    } else {
    const cartaUrl = body.cartaUrl;

    if (!restaurantId || !cartaUrl) {
      return NextResponse.json({ error: "Falta restaurantId o cartaUrl" }, { status: 400 });
    }

    // Detect provider for better extraction
    const provider = await prisma.menuProvider.findFirst({
      where: { domainPatterns: { hasSome: [new URL(cartaUrl).hostname.replace(/^www\./, "")] } },
      select: { name: true, extractionConfig: true },
    }).catch(() => null);

    // Check if it's a Google Drive link
    if (cartaUrl.includes("drive.google.com") || cartaUrl.includes("docs.google.com")) {
      extraction = await extractGoogleDrive(cartaUrl);
    } else {
      extraction = await extractWithScraper(cartaUrl, provider?.name, provider?.extractionConfig);
    }
    } // end else (link mode)
  }

  if (!extraction.dishes.length) {
    return NextResponse.json({ error: "No se encontraron platos en la carta" }, { status: 400 });
  }

  // Verify restaurant exists and user has access
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, name: true },
  });
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });
  }

  // Delete existing dishes and categories
  await prisma.dish.deleteMany({ where: { restaurantId } });
  await prisma.category.deleteMany({ where: { restaurantId } });

  // Create new categories and dishes from extraction
  const categoryMap = new Map<string, typeof extraction.dishes>();
  for (const dish of extraction.dishes) {
    const cat = dish.category || "General";
    if (!categoryMap.has(cat)) categoryMap.set(cat, []);
    categoryMap.get(cat)!.push(dish);
  }

  let catPosition = 0;
  let totalDishes = 0;

  for (const [catName, catDishes] of categoryMap) {
    const category = await prisma.category.create({
      data: {
        restaurantId,
        name: catName,
        position: catPosition++,
        dishType: detectDishType(catName),
        isActive: true,
      },
    });

    const isDrinkCat = category.dishType === "drink" || /caf[eé]|t[eé]\b|infusi[oó]n|bebida|bebestible|jugo|trago/i.test(catName);

    for (let j = 0; j < catDishes.length; j++) {
      const dish = catDishes[j];
      if (isBulkProduct(dish.name, dish.description)) continue;
      const detected = detectDishFlags({ name: dish.name, description: dish.description, ingredients: "" });

      await prisma.dish.create({
        data: {
          restaurantId,
          categoryId: category.id,
          name: dish.name.trim(),
          description: dish.description || null,
          price: dish.price,
          photos: dish.imageUrl ? [dish.imageUrl] : [],
          position: j,
          dishDiet: isDrinkCat ? "OMNIVORE" : ((dish as any).diet && ["VEGAN", "VEGETARIAN"].includes((dish as any).diet) ? (dish as any).diet : "OMNIVORE"),
          isSpicy: (dish as any).isSpicy || detected.isSpicy,
          tags: j === 0 && catPosition <= 2 ? ["RECOMMENDED"] : [],
          containsNuts: isDrinkCat ? false : detected.containsNuts,
          isGlutenFree: isDrinkCat ? false : detected.isGlutenFree,
          isLactoseFree: isDrinkCat ? false : detected.isLactoseFree,
          isSoyFree: isDrinkCat ? false : detected.isSoyFree,
          isActive: true,
          txDishType: [], txCuisine: [], txMealSlot: [], txIngredient: [], txEstilo: [],
        },
      });
      totalDishes++;
    }
  }

  // Mark menu as imported + update logo if extracted + queue translation
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      menuImported: true,
      needsTranslation: true,
      ...(extraction.logoUrl ? { logoUrl: extraction.logoUrl } : {}),
    },
  }).catch(() => {});

  // Traducir primeros 5 platos en background (el cron traduce el resto via needsTranslation)
  import("@/lib/ai/translateContent").then(({ translateDish }) => {
    (async () => {
      const dishes = await prisma.dish.findMany({
        where: { restaurantId, description: { not: null } },
        select: { id: true },
        take: 5,
        orderBy: { position: "asc" },
      });
      for (const d of dishes) await translateDish(d.id).catch(() => {});
    })();
  }).catch(() => {});

  // Log activity so it appears in /admin/clientes timeline
  import("@/lib/admin/logActivity").then(({ logActivity }) => {
    logActivity(restaurantId, "menu_import", {
      dishes: totalDishes,
      categories: categoryMap.size,
      source: contentType.includes("multipart") ? "file" : "link",
    });
  }).catch(() => {});

  // Sync imported dishes to Meilisearch (fire-and-forget)
  import("@/lib/meilisearch").then(({ syncRestaurantToMeilisearch }) => {
    syncRestaurantToMeilisearch(restaurantId).catch(() => {});
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    dishes: totalDishes,
    categories: categoryMap.size,
    restaurantName: extraction.restaurantName,
  });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    // Log failure so it appears in /admin/clientes timeline
    if (restaurantId) {
      import("@/lib/admin/logActivity").then(({ logActivity }) => {
        logActivity(restaurantId, "menu_import_failed", {
          error: errorMsg.slice(0, 200),
          source: contentType.includes("multipart") ? "file" : "link",
        });
      }).catch(() => {});
    }
    console.error("[ImportMenu] Error:", errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
