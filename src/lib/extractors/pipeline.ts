import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import sharp from "sharp";
import bcrypt from "bcryptjs";
import { extractJusto } from "./justo";
import { extractUberEats } from "./ubereats";
import { extractQueresto } from "./queresto";
import { extractMiCartaQR } from "./micartaqr";
import { extractWithScraper } from "./scrape";
import { extractFromDocument } from "./document";
import { extractGoogleDrive } from "./googledrive";
import { extractHeyzine } from "./heyzine";
import { extractCanva } from "./canva";
import { detectDishFlags } from "@/lib/utils/detectDishFlags";
import type { ExtractionResult, ExtractedDish } from "./types";

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

/** Try to upgrade a thumbnail URL to a higher resolution version */
function upgradePhotoUrl(url: string): string {
  let upgraded = url;
  // Common CDN resize patterns → request larger
  upgraded = upgraded
    .replace(/\/w_\d+/g, "/w_1200").replace(/\/h_\d+/g, "/h_1200")
    .replace(/\?width=\d+/g, "?width=1200").replace(/&width=\d+/g, "&width=1200")
    .replace(/\?w=\d+/g, "?w=1200").replace(/&w=\d+/g, "&w=1200")
    .replace(/\?height=\d+/g, "?height=1200").replace(/&height=\d+/g, "&height=1200")
    .replace(/\/\d+x\d+\//g, "/1200x1200/")
    .replace(/_\d+x\d+\./g, ".")
    .replace(/-\d+x\d+\./g, ".")
    // Shopify/CDN thumb → large
    .replace(/_(?:small|compact|medium|grande|thumb|thumbnail|large)(\.\w+)$/, "$1")
    .replace(/\/(?:small|compact|medium|thumb|thumbnail)\//, "/large/")
    // Cloudinary transforms
    .replace(/\/c_\w+,w_\d+,h_\d+/, "/c_fill,w_1200,h_1200")
    .replace(/\/t_\w+\//, "/t_original/");
  return upgraded;
}

async function reuploadPhoto(externalUrl: string, restaurantId: string, dishSlug: string): Promise<string | null> {
  try {
    // Try upgraded URL first, fallback to original
    const hdUrl = upgradePhotoUrl(externalUrl);
    let res = await fetch(hdUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; QuieroComer/1.0)" },
      signal: AbortSignal.timeout(8000),
    }).catch(() => null);
    if (!res || !res.ok) {
      res = await fetch(externalUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; QuieroComer/1.0)" },
        signal: AbortSignal.timeout(8000),
      });
    }
    if (!res.ok) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 500) return null;

    let pipeline = sharp(buffer);
    const meta = await pipeline.metadata();
    if (!meta.format) return null;
    if ((meta.width && meta.width > 1200) || (meta.height && meta.height > 1200)) {
      pipeline = pipeline.resize(1200, 1200, { fit: "inside", withoutEnlargement: true });
    }
    const optimized = await pipeline.webp({ quality: 88 }).toBuffer();

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

/** Extract menu data from an uploaded image via Claude Vision */
async function extractFromImage(imageUrl: string): Promise<ExtractionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  // Download and convert images (supports multiple URLs separated by comma)
  const urls = imageUrl.split(",").map(u => u.trim()).filter(Boolean).slice(0, 10);
  const images: { type: "image"; source: { type: "base64"; media_type: string; data: string } }[] = [];

  for (const url of urls) {
    try {
      const imgRes = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!imgRes.ok) continue;
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      let base64: string;
      let mediaType = "image/jpeg";
      try {
        const jpegBuffer = await sharp(buffer)
          .jpeg({ quality: 85 })
          .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
          .toBuffer();
        base64 = jpegBuffer.toString("base64");
      } catch (sharpErr) {
        // Sharp failed — try without resize (some formats need simpler pipeline)
        try {
          const fallbackBuffer = await sharp(buffer).jpeg({ quality: 80 }).toBuffer();
          base64 = fallbackBuffer.toString("base64");
          console.log(`[Image] Sharp resize failed, converted without resize: ${url.slice(-30)}`);
        } catch {
          // Truly unsupported — skip SVG/BMP but try sending others as-is
          const ext = url.split("?")[0].split(".").pop()?.toLowerCase() || "";
          if (["svg", "bmp"].includes(ext)) {
            console.log(`[Image] Skipping unsupported format: ${ext}`);
            continue;
          }
          // For HEIC/HEIF: if sharp can't handle it, skip (local dev) — in production sharp supports it
          if (["heic", "heif"].includes(ext)) {
            console.log(`[Image] HEIC conversion failed (likely local dev without libvips HEIF support). Skipping: ${url.slice(-30)}`);
            continue;
          }
          base64 = buffer.toString("base64");
          if (url.endsWith(".png")) mediaType = "image/png";
          else if (url.endsWith(".webp")) mediaType = "image/webp";
        }
      }
      images.push({ type: "image", source: { type: "base64", media_type: mediaType, data: base64 } });
    } catch {}
  }
  if (images.length === 0) throw new Error("No images could be downloaded");

  const prompt = `Analiza ${images.length > 1 ? "estas fotos" : "esta foto"} de carta/menú de restaurante.
Extrae TODOS los platos que puedas ver y organízalos por categoría.
IMPORTANTE: Solo extrae platos que puedas leer claramente. NO inventes ni agregues platos que no estén visibles.
Responde SOLO con JSON:
{"restaurantName":"...","categories":[{"name":"...","type":"food"|"drink"|"dessert","dishes":[{"name":"...","description":"...","price":8990,"diet":"OMNIVORE"|"VEGAN"|"VEGETARIAN","isSpicy":false}]}]}
Reglas:
- Precios enteros sin puntos ($8.990→8990). Si no hay precio, pon 0.
- No inventes platos, solo extrae lo que ves.
- SOLO JSON.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      messages: [{
        role: "user",
        content: [
          ...images,
          { type: "text", text: prompt },
        ],
      }],
    }),
  });

  if (!res.ok) throw new Error(`Claude Vision error: ${res.status}`);
  const data = await res.json();
  const text = data.content?.[0]?.text || "";

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in Vision response");

  let parsed: any;
  try { parsed = JSON.parse(match[0]); } catch {
    let jsonStr = match[0].replace(/,\s*\{[^}]*$/, "").replace(/,\s*$/, "");
    let o = 0, c = 0; for (const ch of jsonStr) { if (ch === "[") o++; if (ch === "]") c++; }
    for (let i = 0; i < o - c; i++) jsonStr += "]";
    let oo = 0, cc = 0; for (const ch of jsonStr) { if (ch === "{") oo++; if (ch === "}") cc++; }
    for (let i = 0; i < oo - cc; i++) jsonStr += "}";
    parsed = JSON.parse(jsonStr);
  }

  // Search Unsplash photos for dishes (batch, max 15 to respect rate limits)
  const { searchUnsplashPhoto, triggerUnsplashDownload } = await import("@/lib/unsplash");
  const photoMap = new Map<string, string>();
  const creditMap = new Map<string, { photographer: string; profileUrl: string; unsplashId: string }>();
  if (process.env.UNSPLASH_ACCESS_KEY) {
    const allDishes = (parsed.categories || []).flatMap((c: any) =>
      (c.dishes || []).map((d: any) => ({ name: d.name, category: c.name }))
    ).filter((d: any) => d.name).slice(0, 50);

    await Promise.allSettled(allDishes.map(async (d: any) => {
      for (const query of [`${d.name} food`, `${d.category} ${d.name} restaurant`, `${d.category} food dish`]) {
        const photo = await searchUnsplashPhoto(query);
        if (photo) {
          photoMap.set(d.name, photo.rawUrl);
          creditMap.set(d.name, { photographer: photo.photographer, profileUrl: photo.profileUrl, unsplashId: photo.unsplashId });
          triggerUnsplashDownload(photo.downloadLocation).catch(() => {});
          return;
        }
      }
    }));
  }

  const dishes: ExtractedDish[] = [];
  for (const cat of (parsed.categories || [])) {
    for (const dish of (cat.dishes || [])) {
      if (!dish.name) continue;
      dishes.push({
        name: dish.name.trim(),
        description: dish.description || "",
        price: typeof dish.price === "number" ? dish.price : parseInt(String(dish.price).replace(/\D/g, ""), 10) || 0,
        imageUrl: photoMap.get(dish.name) || null,
        photoCredit: creditMap.get(dish.name) || null,
        category: cat.name || "General",
        diet: dish.diet || "OMNIVORE",
        isSpicy: dish.isSpicy || false,
      });
    }
  }

  return {
    restaurantName: parsed.restaurantName || "Restaurante",
    dishes,
    logoUrl: null,
    bannerUrl: null,
  };
}

/** Extract menu data based on detected provider */
async function extractMenu(cartaUrl: string, providerName: string | null, extractionConfig?: any): Promise<ExtractionResult> {
  // Route to the correct extractor
  switch (providerName) {
    case "Justo":
      return extractJusto(cartaUrl);
    case "UberEats":
      return extractUberEats(cartaUrl);
    case "Queresto":
      return extractQueresto(cartaUrl);
    case "MiCartaQR":
      return extractMiCartaQR(cartaUrl);
    case "GoogleDrive":
      return extractGoogleDrive(cartaUrl);
    case "Heyzine":
      return extractHeyzine(cartaUrl);
    case "Canva":
      return extractCanva(cartaUrl);
    case "Dropbox":
    case "OneDrive":
      // Cloud storage PDFs: treat as generic document via the scraper
      // (Jina can't render cloud storage; fall through to generic)
      // For Dropbox: dl=1 param gives direct download, handled by generic extractor
      return extractWithScraper(cartaUrl, providerName, extractionConfig);
    case "Fudo":
    case "Mercat":
    case "Gourmedia":
    default:
      // Generic scraper: Jina AI + Claude. Works with any provider.
      return extractWithScraper(cartaUrl, providerName, extractionConfig);
  }
}

/**
 * Process a single lead: extract menu data, create Restaurant + Categories + Dishes.
 * Returns the created restaurant slug or throws on failure.
 */
export async function processLead(leadId: string): Promise<{ slug: string; url: string }> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { detectedProvider: { select: { name: true, extractionConfig: true } } },
  });

  if (!lead) throw new Error(`Lead ${leadId} not found`);
  if (!lead.cartaUrl && !lead.cartaFileUrl) throw new Error(`Lead ${leadId} has no cartaUrl or cartaFileUrl`);

  // Guard: skip if already processing, ready, or delivered
  if (["PROCESSING", "READY", "DELIVERED"].includes(lead.cartaStatus || "")) {
    const existing = lead.generatedSlug || "";
    console.log(`[Pipeline] Lead ${leadId} already ${lead.cartaStatus} — skipping`);
    return { slug: existing, url: existing ? `${process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl"}/qr/${existing}` : "" };
  }

  // Mark as processing
  await prisma.lead.update({ where: { id: leadId }, data: { cartaStatus: "PROCESSING" } });

  // Safety timeout: if pipeline hangs, mark as FAILED
  // Google Drive PDFs with many pages need more time (8+ Claude calls)
  const isCloudStorage = ["GoogleDrive", "Dropbox", "OneDrive"].includes(lead.detectedProvider?.name || "");
  const timeoutMs = isCloudStorage ? 480000 : 240000; // 8 min for cloud storage, 4 min for others
  const pipelineTimeout = setTimeout(async () => {
    console.error(`[Pipeline] Timeout for lead ${leadId} — marking FAILED`);
    await prisma.lead.update({ where: { id: leadId }, data: { cartaStatus: "FAILED", errorLog: "Pipeline timeout" } }).catch(() => {});
  }, timeoutMs);

  try {
    const providerName = lead.detectedProvider?.name || null;
    const providerConfig = (lead.detectedProvider as any)?.extractionConfig || null;
    const isFileUpload = !lead.cartaUrl && !!lead.cartaFileUrl;
    const isDocument = lead.cartaType === "DOCUMENT";

    // For file uploads, load the _Document / _Photo global config
    let fileConfig: any = null;
    if (isFileUpload) {
      const configProvider = await prisma.menuProvider.findFirst({
        where: { name: isDocument ? "_Document" : "_Photo" },
        select: { extractionConfig: true },
      });
      fileConfig = configProvider?.extractionConfig || null;
    }

    const extraction = isFileUpload
      ? (isDocument ? await extractFromDocument(lead.cartaFileUrl!, fileConfig) : await extractFromImage(lead.cartaFileUrl!))
      : await extractMenu(lead.cartaUrl!, providerName, providerConfig);

    if (extraction.dishes.length === 0) {
      throw new Error("No dishes extracted from the menu");
    }

    // Validate extraction quality — if too few dishes or no prices, flag for review
    const dishesWithPrice = extraction.dishes.filter(d => d.price > 0);
    if (extraction.dishes.length < 3 || dishesWithPrice.length === 0) {
      throw new Error(`Low quality extraction: ${extraction.dishes.length} dishes, ${dishesWithPrice.length} with price`);
    }

    // Save preview to lead (for confirmation page)
    const existingPreview = lead.preview as any;
    const previewIsValid = existingPreview?.sampleDishes?.length > 0 && existingPreview.sampleDishes.some((d: any) => d.price > 0 || d.imageUrl);
    if (!previewIsValid) {
      const categories = new Set(extraction.dishes.map((d) => d.category));
      const previewData = {
        restaurantName: extraction.restaurantName.split("|")[0].split("-")[0].split("·")[0].split("—")[0].split("Pide")[0].split("Order")[0].trim(),
        logoUrl: extraction.logoUrl,
        totalDishes: extraction.dishes.length,
        totalCategories: categories.size,
        sampleDishes: [...extraction.dishes.filter(d => d.imageUrl), ...extraction.dishes.filter(d => !d.imageUrl)].slice(0, 5).map((d) => ({
          name: d.name,
          description: d.description || "",
          price: d.price,
          imageUrl: d.imageUrl,
          category: d.category,
        })),
      };
      await prisma.lead.update({ where: { id: leadId }, data: { preview: previewData as any } });
    }

    // Generate unique slug
    const rawBaseName = lead.localName?.trim() || extraction.restaurantName;
    // Smart casing
    const baseName = rawBaseName === rawBaseName.toUpperCase() || rawBaseName === rawBaseName.toLowerCase()
      ? rawBaseName.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      : rawBaseName;
    const cleanedName = baseName.split("|")[0].split("-")[0].split("·")[0].split("—")[0].split("Pide")[0].split("Order")[0].trim();

    let slug = slugify(cleanedName);
    if (!slug) slug = `local-${Date.now().toString(36)}`;
    const existingRest = await prisma.restaurant.findUnique({ where: { slug } });

    // If restaurant already exists with this slug, reuse it instead of creating a duplicate
    if (existingRest) {
      console.log(`[Pipeline] Restaurant "${slug}" already exists — reusing (${existingRest.id})`);
      // Update slug on lead and mark as ready
      await prisma.lead.update({ where: { id: leadId }, data: { generatedSlug: slug, cartaStatus: "READY", readyAt: new Date() } });
      clearTimeout(pipelineTimeout);
      const url = `${process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl"}/qr/${slug}`;
      return { slug, url };
    }

    // Create restaurant
    const qrToken = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const restaurant = await prisma.restaurant.create({
      data: {
        name: cleanedName,
        slug,
        logoUrl: extraction.logoUrl,
        cartaTheme: "PREMIUM",
        cartaColorMode: "DARK",
        defaultView: "lista",
        enabledLangs: ["es", "en", "pt"],
        isActive: true,
        isDemo: true,
        weeklyEmailEnabled: true,
        qrToken,
        qrActivatedAt: new Date(),
        plan: "PREMIUM",
        subscriptionStatus: "NONE",
        waiterPanelActive: true,
        website: lead.cartaUrl,
      },
    });

    // Create or link owner from lead data
    if (lead.email) {
      let owner = await prisma.restaurantOwner.findFirst({ where: { email: lead.email } });
      if (!owner) {
        const passwordHash = await bcrypt.hash(`${slug}2026`, 10);
        owner = await prisma.restaurantOwner.create({
          data: { name: lead.ownerName || cleanedName, email: lead.email, passwordHash, role: "OWNER", whatsapp: lead.whatsapp || undefined },
        });
      }
      await prisma.restaurant.update({ where: { id: restaurant.id }, data: { ownerId: owner.id } });
    }

    // Group dishes by category
    const categoryMap = new Map<string, typeof extraction.dishes>();
    for (const dish of extraction.dishes) {
      const cat = dish.category || "General";
      if (!categoryMap.has(cat)) categoryMap.set(cat, []);
      categoryMap.get(cat)!.push(dish);
    }

    // Create categories and dishes
    const createdDishes: { id: string; name: string; description: string | null; externalPhoto: string | null; credit: { photographer: string; profileUrl: string; unsplashId: string } | null }[] = [];
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
            dishDiet: isDrinkCat ? "OMNIVORE" : ((dish as any).diet && ["VEGAN", "VEGETARIAN"].includes((dish as any).diet) ? (dish as any).diet : "OMNIVORE"),
            isSpicy: (dish as any).isSpicy || detected.isSpicy,
            tags: j === 0 && catPosition <= 2 ? ["RECOMMENDED"] : [],
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
          credit: dish.photoCredit || null,
        });
      }
    }

    // Mark lead as READY early — before slow operations (photos, translations)
    // so a timeout won't mark it FAILED after the restaurant already exists
    const cartaUrl = `https://quierocomer.cl/qr/${restaurant.slug}?t=${qrToken}`;
    await prisma.lead.update({
      where: { id: leadId },
      data: { cartaStatus: "READY", generatedSlug: restaurant.slug, readyAt: new Date() },
    });
    clearTimeout(pipelineTimeout);
    console.log(`[Pipeline] Lead ${leadId} READY: ${restaurant.name} → ${cartaUrl} (${createdDishes.length} dishes)`);

    // Process photos: restaurant-owned → Supabase, Unsplash → hotlink direct
    const dishesWithPhotos = createdDishes.filter((d) => d.externalPhoto);
    if (dishesWithPhotos.length > 0) {
      const BATCH = 10;
      for (let i = 0; i < dishesWithPhotos.length; i += BATCH) {
        const batch = dishesWithPhotos.slice(i, i + BATCH);
        await Promise.allSettled(
          batch.map(async (dish) => {
            const credit = dish.credit;
            const isUnsplash = !!credit; // has credit = came from Unsplash
            let finalUrl: string;

            if (isUnsplash) {
              // Unsplash: store rawUrl, components apply size params at render time
              finalUrl = dish.externalPhoto!;
            } else {
              // Restaurant's own photo: re-upload to Supabase for optimization
              const dishSlug = slugify(dish.name);
              const supabaseUrl = await reuploadPhoto(dish.externalPhoto!, restaurant.id, dishSlug);
              finalUrl = supabaseUrl || dish.externalPhoto!;
            }

            const updateData: any = { photos: [finalUrl], isPhotoReferential: isUnsplash };
            if (credit) updateData.photoCredits = [credit];
            await prisma.dish.update({ where: { id: dish.id }, data: updateData });
          }),
        );
      }
    }

    // Run Unsplash photo fill + translations in parallel (independent: photos→dish.photos, translations→dishTranslation)
    let translationOk = true;

    const unsplashTask = (async () => {
      if (!process.env.UNSPLASH_ACCESS_KEY) return;
      const { searchUnsplashPhoto: searchPhoto, triggerUnsplashDownload: triggerDl } = await import("@/lib/unsplash");
      // Only fetch photos for hero (RECOMMENDED) + first 30% of dishes for demo
      // Full photo fill happens on activation via backfill
      const allDishesDB = await prisma.dish.findMany({
        where: { restaurantId: restaurant.id, isActive: true },
        orderBy: [{ category: { position: "asc" } }, { position: "asc" }],
        select: { id: true, name: true, photos: true, tags: true },
      });
      const cap = Math.min(20, Math.ceil(allDishesDB.length * 0.3));
      const heroIds = new Set(allDishesDB.filter(d => d.tags?.includes("RECOMMENDED")).map(d => d.id));
      const priorityDishes = [
        ...allDishesDB.filter(d => heroIds.has(d.id)),
        ...allDishesDB.filter(d => !heroIds.has(d.id)).slice(0, cap),
      ].slice(0, 20);
      const missing = priorityDishes.filter(d => !d.photos?.length);
      console.log(`[Pipeline] Unsplash: ${missing.length}/${allDishesDB.length} priority dishes need photos`);
      if (missing.length > 0) {
        await Promise.allSettled(missing.map(async (d) => {
          try {
            const photo = await searchPhoto(`${d.name} food dish`);
            if (photo) {
              await prisma.dish.update({
                where: { id: d.id },
                data: {
                  photos: [photo.rawUrl],
                  isPhotoReferential: true,
                  photoCredits: [{ photographer: photo.photographer, profileUrl: photo.profileUrl, unsplashId: photo.unsplashId }],
                },
              });
              triggerDl(photo.downloadLocation).catch(() => {});
            }
          } catch {}
        }));
      }
    })();

    const translationTask = (async () => {
      if (createdDishes.length === 0) return;
      try {
        const { translateDishBulk, translateCategoryBulk } = await import("@/lib/ai/translateContent");

        // Only translate hero dishes (RECOMMENDED) + first 30% of dishes for demo preview
        // Full translation happens on activation (see /api/activar/trial)
        const allDishData = await prisma.dish.findMany({
          where: { id: { in: createdDishes.map(d => d.id) } },
          include: { category: { select: { position: true } } },
          orderBy: [{ category: { position: "asc" } }, { position: "asc" }],
        });

        // Priority: RECOMMENDED first, then first dishes by category order, max 10 total
        const recommended = allDishData.filter(d => d.tags?.includes("RECOMMENDED"));
        const priorityIds = new Set(recommended.map(d => d.id));
        const remaining = allDishData.filter(d => !priorityIds.has(d.id)).slice(0, 10 - recommended.length);
        const dishData = [...recommended, ...remaining].slice(0, 10).map(d => ({ id: d.id, name: d.name, description: d.description }));

        console.log(`[Pipeline] Translating ${dishData.length}/${createdDishes.length} priority dishes for ${restaurant.slug} (${recommended.length} hero + ${remaining.length} first sections)`);

        let translated = 0;
        for (let i = 0; i < dishData.length; i += 12) {
          const batch = dishData.slice(i, i + 12);
          translated += await translateDishBulk(batch);
        }
        // Always translate all categories (they're just names, very fast)
        const cats = await prisma.category.findMany({ where: { restaurantId: restaurant.id }, select: { id: true, name: true } });
        await translateCategoryBulk(cats);

        console.log(`[Pipeline] Translated ${translated}/${dishData.length} priority dishes for ${restaurant.slug}`);
        if (translated === 0) {
          translationOk = false;
        }
      } catch (err) {
        console.error(`[Pipeline] Translation failed for ${restaurant.slug}:`, err);
        translationOk = false;
      }
    })();

    await Promise.all([unsplashTask, translationTask]);

    // Always flag for backfill — we only translate ~30% here, full translation on activation
    await prisma.restaurant.update({ where: { id: restaurant.id }, data: { needsTranslation: true } }).catch(() => {});

    console.log(`[Pipeline] Lead ${leadId} post-processing done: photos + translations for ${restaurant.name}`);

    // Send email with carta link (priority dishes translated, full backfill on activation)
    if (lead.email && translationOk) {
      try {
        const { sendAdminEmail } = await import("@/lib/email/sendAdminEmail");
        const { cartaReadyEmailHtml } = await import("@/lib/email/cartaReadyEmailHtml");
        const ownerName = lead.ownerName || "Hola";
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";
        const openPixel = `${baseUrl}/api/funnel/track/open?lid=${leadId}`;
        const clickUrl = `${baseUrl}/api/funnel/track/click?lid=${leadId}&url=${encodeURIComponent(cartaUrl)}`;
        const activarUrl = `${baseUrl}/activar/${restaurant.slug}`;
        // Try to build auto-login URL if owner exists
        let panelUrl = `${baseUrl}/panel`;
        try {
          const owner = await prisma.restaurantOwner.findFirst({
            where: { restaurants: { some: { id: restaurant.id } }, status: "ACTIVE" },
            select: { id: true },
          });
          if (owner) {
            const { buildAutoLoginUrl } = await import("@/lib/email/autoLoginUrl");
            panelUrl = buildAutoLoginUrl(baseUrl, owner.id);
          }
        } catch {}

        await sendAdminEmail({
          to: lead.email,
          subject: `Tu nueva carta ${restaurant.name} está lista`,
          purpose: "funnel_carta_ready",
          html: cartaReadyEmailHtml({
            ownerName,
            restaurantName: restaurant.name,
            logoUrl: restaurant.logoUrl,
            dishCount: createdDishes.length,
            clickUrl,
            openPixel,
            activarUrl,
            panelUrl,
          }),
        });
        await prisma.lead.update({ where: { id: leadId }, data: { cartaStatus: "DELIVERED", deliveredAt: new Date() } });
        console.log(`[Pipeline] Email sent to ${lead.email}`);
      } catch (emailErr) {
        console.error("[Pipeline] Email failed:", emailErr);
      }
    }

    // Send WhatsApp alongside email
    if (lead.whatsapp && translationOk) {
      try {
        const { sendWhatsApp, buildCartaReadyMessage } = await import("@/lib/whatsapp");
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";
        const waTrackUrl = `${baseUrl}/c/${restaurant.slug}`;
        const ownerName = (lead.ownerName || "Hola").split(" ")[0];
        const msg = buildCartaReadyMessage({
          ownerName,
          restaurantName: restaurant.name,
          trackUrl: waTrackUrl,
        });
        const sid = await sendWhatsApp({
          to: lead.whatsapp,
          ...msg,
        });
        if (sid) {
          await prisma.lead.update({ where: { id: leadId }, data: { whatsappSentAt: new Date() } });
          console.log(`[Pipeline] WhatsApp sent to ${lead.whatsapp}`);
        }
      } catch (waErr) {
        console.error("[Pipeline] WhatsApp failed:", waErr);
      }
    }

    // Notify admin of new lead processed
    try {
      const { sendAdminPush } = await import("@/lib/adminPush");
      await sendAdminPush(
        "🧞 Nueva carta creada",
        `${restaurant.name} · ${createdDishes.length} platos`,
        cartaUrl,
      );
    } catch {}

    // Track provider success
    if (lead.detectedProviderId) {
      await prisma.menuProvider.update({
        where: { id: lead.detectedProviderId },
        data: { successCount: { increment: 1 } },
      }).catch(() => {});
    }

    return { slug: restaurant.slug, url: cartaUrl };
  } catch (error) {
    clearTimeout(pipelineTimeout);
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Mark as FAILED with error log
    await prisma.lead.update({
      where: { id: leadId },
      data: { cartaStatus: "FAILED", errorLog: errorMsg.slice(0, 500) },
    });

    // Track provider failure
    if (lead.detectedProviderId) {
      await prisma.menuProvider.update({
        where: { id: lead.detectedProviderId },
        data: {
          failCount: { increment: 1 },
          lastFailReason: errorMsg.slice(0, 200),
          lastFailAt: new Date(),
        },
      }).catch(() => {});
    }

    // Send WhatsApp on failure using approved template
    if (lead.whatsapp) {
      try {
        // Check if this error warrants a WA notification
        let shouldNotify = false;
        if (lead.detectedProviderId) {
          const provider = await prisma.menuProvider.findUnique({ where: { id: lead.detectedProviderId }, select: { extractionConfig: true } });
          shouldNotify = !!(provider?.extractionConfig as any)?.failMessage || !!(provider?.extractionConfig as any)?.notScrapeable;
        }
        if (!shouldNotify && (errorMsg.includes("No se pudo acceder") || errorMsg.includes("Failed to fetch") || errorMsg.includes("No dishes extracted"))) {
          shouldNotify = true;
        }

        if (shouldNotify) {
          const SID = process.env.TWILIO_ACCOUNT_SID;
          const TOKEN = process.env.TWILIO_AUTH_TOKEN;
          const FROM = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
          const FAIL_TEMPLATE = "HX0bdab227710250fd28be04263845fb99";
          if (SID && TOKEN) {
            const phone = lead.whatsapp.startsWith("+") ? lead.whatsapp : `+${lead.whatsapp}`;
            const ownerName = (lead.ownerName || "").split(" ")[0] || "Hola";
            const params: Record<string, string> = {
              From: FROM,
              To: `whatsapp:${phone}`,
              ContentSid: FAIL_TEMPLATE,
              ContentVariables: JSON.stringify({ "1": ownerName }),
            };
            const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
              method: "POST",
              headers: { "Authorization": "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams(params),
              signal: AbortSignal.timeout(10000),
            });
            const data = await res.json();
            if (data.sid) {
              await prisma.lead.update({ where: { id: leadId }, data: { whatsappSentAt: new Date() } });
              console.log(`[Pipeline] Sent fail template WA to ${phone}`);
            } else {
              console.log(`[Pipeline] Fail template WA error: ${data.error_message || data.message}`);
            }
          }
        }
      } catch {}
    }

    // Notify admin with error details
    try {
      const { sendAdminPush } = await import("@/lib/adminPush");
      await sendAdminPush(
        "⚠️ Lead falló",
        `${lead.localName || lead.cartaUrl?.slice(0, 30)}: ${errorMsg.slice(0, 80)}`,
      );
    } catch {}
    throw error;
  }
}
