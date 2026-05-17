import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import sharp from "sharp";
import { extractJusto } from "./justo";
import { extractUberEats } from "./ubereats";
import { extractQueresto } from "./queresto";
import { extractWithScraper } from "./scrape";
import { extractFromDocument } from "./document";
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
      } catch {
        base64 = buffer.toString("base64");
        if (url.endsWith(".png")) mediaType = "image/png";
        else if (url.endsWith(".webp")) mediaType = "image/webp";
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
  const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;
  const photoMap = new Map<string, string>();
  if (UNSPLASH_KEY) {
    const allDishes = (parsed.categories || []).flatMap((c: any) =>
      (c.dishes || []).map((d: any) => ({ name: d.name, category: c.name }))
    ).filter((d: any) => d.name).slice(0, 15);

    await Promise.allSettled(allDishes.map(async (d: any) => {
      try {
        // Try dish name first, then category as fallback
        for (const query of [`${d.name} food`, `${d.category} ${d.name} restaurant`, `${d.category} food dish`]) {
          const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`, {
            headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
            signal: AbortSignal.timeout(5000),
          });
          if (res.ok) {
            const data = await res.json();
            const url = data.results?.[0]?.urls?.regular;
            if (url) { photoMap.set(d.name, url); return; }
          }
        }
      } catch {}
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
async function extractMenu(cartaUrl: string, providerName: string | null): Promise<ExtractionResult> {
  // Route to the correct extractor
  switch (providerName) {
    case "Justo":
      return extractJusto(cartaUrl);
    case "UberEats":
      return extractUberEats(cartaUrl);
    case "Queresto":
      return extractQueresto(cartaUrl);
    case "Fudo":
    case "Mercat":
    case "Gourmedia":
    default:
      // Generic scraper: Jina AI + Claude. Works with any provider.
      return extractWithScraper(cartaUrl, providerName);
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
  if (!lead.cartaUrl && !lead.cartaFileUrl) throw new Error(`Lead ${leadId} has no cartaUrl or cartaFileUrl`);

  // Mark as processing
  await prisma.lead.update({ where: { id: leadId }, data: { cartaStatus: "PROCESSING" } });

  // Safety timeout: if pipeline hangs, mark as FAILED
  const pipelineTimeout = setTimeout(async () => {
    console.error(`[Pipeline] Timeout for lead ${leadId} — marking FAILED`);
    await prisma.lead.update({ where: { id: leadId }, data: { cartaStatus: "FAILED" } }).catch(() => {});
  }, 240000); // 4 minutes

  try {
    const providerName = lead.detectedProvider?.name || null;
    const isFileUpload = !lead.cartaUrl && !!lead.cartaFileUrl;
    const isDocument = lead.cartaType === "DOCUMENT";
    const extraction = isFileUpload
      ? (isDocument ? await extractFromDocument(lead.cartaFileUrl!) : await extractFromImage(lead.cartaFileUrl!))
      : await extractMenu(lead.cartaUrl!, providerName);

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
    const existing = await prisma.restaurant.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

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

    // Ensure first 5 dishes have photos (fill with Unsplash if missing)
    const UNSPLASH_KEY_FILL = process.env.UNSPLASH_ACCESS_KEY;
    if (UNSPLASH_KEY_FILL) {
      const first5 = await prisma.dish.findMany({
        where: { restaurantId: restaurant.id, isActive: true },
        orderBy: { position: "asc" },
        take: 5,
        select: { id: true, name: true, photos: true },
      });
      const missing = first5.filter(d => !d.photos?.length);
      if (missing.length > 0) {
        await Promise.allSettled(missing.map(async (d) => {
          try {
            const query = `${d.name} food dish`;
            const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`, {
              headers: { Authorization: `Client-ID ${UNSPLASH_KEY_FILL}` },
              signal: AbortSignal.timeout(5000),
            });
            if (res.ok) {
              const data = await res.json();
              const url = data.results?.[0]?.urls?.regular;
              if (url) {
                const dishSlug = slugify(d.name);
                const supabaseUrl = await reuploadPhoto(url, restaurant.id, dishSlug);
                await prisma.dish.update({ where: { id: d.id }, data: { photos: [supabaseUrl || url], isPhotoReferential: true } });
              }
            }
          } catch {}
        }));
      }
    }

    // Translate dishes + categories with timeout (awaited, not fire-and-forget)
    let translationOk = true;
    if (createdDishes.length > 0) {
      try {
        const { translateDish, translateCategory } = await import("@/lib/ai/translateContent");

        const translateAll = async () => {
          // Translate dishes in batches of 3
          let translated = 0;
          for (let i = 0; i < createdDishes.length; i += 3) {
            const batch = createdDishes.slice(i, i + 3);
            const results = await Promise.allSettled(batch.map((d) => translateDish(d.id)));
            translated += results.filter(r => r.status === "fulfilled").length;
          }

          // Translate categories
          const cats = await prisma.category.findMany({ where: { restaurantId: restaurant.id }, select: { id: true } });
          for (let i = 0; i < cats.length; i += 3) {
            const batch = cats.slice(i, i + 3);
            await Promise.allSettled(batch.map((c) => translateCategory(c.id)));
          }

          return translated;
        };

        // Race against 90s timeout
        const result = await Promise.race([
          translateAll(),
          new Promise<"timeout">((r) => setTimeout(() => r("timeout"), 90000)),
        ]);

        if (result === "timeout") {
          console.warn(`[Pipeline] Translation timed out for ${restaurant.slug} — marking for backfill`);
          translationOk = false;
        } else if (result < createdDishes.length) {
          console.warn(`[Pipeline] Partial translation for ${restaurant.slug}: ${result}/${createdDishes.length} dishes`);
          translationOk = false;
        } else {
          console.log(`[Pipeline] Translated ${result} dishes for ${restaurant.slug}`);
        }
      } catch (err) {
        console.error(`[Pipeline] Translation failed for ${restaurant.slug}:`, err);
        translationOk = false;
      }
    }

    // If translation failed, flag restaurant for backfill and defer email
    if (!translationOk) {
      await prisma.restaurant.update({ where: { id: restaurant.id }, data: { needsTranslation: true } }).catch(() => {});
    }

    const cartaUrl = `https://quierocomer.cl/qr/${restaurant.slug}?t=${qrToken}`;

    clearTimeout(pipelineTimeout);

    // Mark lead as READY and link to restaurant
    await prisma.lead.update({
      where: { id: leadId },
      data: { cartaStatus: "READY", generatedSlug: restaurant.slug, readyAt: new Date() },
    });

    console.log(`[Pipeline] Lead ${leadId} processed: ${restaurant.name} → ${cartaUrl} (${createdDishes.length} dishes)`);

    // Send email with carta link (only if translation succeeded)
    if (lead.email && translationOk) {
      try {
        const { sendAdminEmail } = await import("@/lib/email/sendAdminEmail");
        const ownerName = lead.ownerName || "Hola";
        await sendAdminEmail({
          to: lead.email,
          subject: `${restaurant.name} · Tu nueva carta está lista`,
          purpose: "funnel_carta_ready",
          html: `
            <div style="font-family: system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 20px;">
              ${restaurant.logoUrl ? `<img src="${restaurant.logoUrl}" alt="${restaurant.name}" style="height: 48px; margin-bottom: 20px; border-radius: 50%;" />` : `<img src="https://quierocomer.cl/landing/logo.png" alt="QuieroComer" style="height: 22px; margin-bottom: 24px;" />`}
              <h1 style="font-size: 24px; font-weight: 700; color: #1a1a1a; margin: 0 0 12px;">
                ${ownerName}, tu carta está lista
              </h1>
              <p style="font-size: 15px; color: #555; line-height: 1.5; margin: 0 0 24px;">
                Transformamos la carta de <strong>${restaurant.name}</strong> en una experiencia digital.
                Tiene ${createdDishes.length} platos organizados y listos para que tus clientes los vean.
              </p>
              <a href="${cartaUrl}" style="display: inline-block; padding: 14px 32px; background: #E8A33D; color: #0e0e0e; font-size: 16px; font-weight: 800; text-decoration: none; border-radius: 12px;">
                Ver mi carta →
              </a>
              <p style="font-size: 13px; color: #999; margin: 24px 0 0; line-height: 1.5;">
                Este link es tu carta viva. Compártelo con tus clientes o imprímelo en un QR.
                Si tienes preguntas, escríbenos a <a href="mailto:hola@quierocomer.cl" style="color: #E8A33D;">hola@quierocomer.cl</a>
              </p>
            </div>
          `,
        });
        await prisma.lead.update({ where: { id: leadId }, data: { cartaStatus: "DELIVERED" } });
        console.log(`[Pipeline] Email sent to ${lead.email}`);
      } catch (emailErr) {
        console.error("[Pipeline] Email failed:", emailErr);
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

    return { slug: restaurant.slug, url: cartaUrl };
  } catch (error) {
    clearTimeout(pipelineTimeout);
    // Mark as FAILED
    await prisma.lead.update({ where: { id: leadId }, data: { cartaStatus: "FAILED" } });
    // Notify admin
    try {
      const { sendAdminPush } = await import("@/lib/adminPush");
      await sendAdminPush(
        "⚠️ Lead sin procesar",
        `${lead.localName || lead.cartaUrl?.slice(0, 30)} quedó PENDING`,
      );
    } catch {}
    throw error;
  }
}
