import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import sharp from "sharp";
import { extractJusto } from "./justo";
import { extractUberEats } from "./ubereats";
import { extractQueresto } from "./queresto";
import { extractWithScraper } from "./scrape";
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
  if (!lead.cartaUrl) throw new Error(`Lead ${leadId} has no cartaUrl`);

  // Mark as processing
  await prisma.lead.update({ where: { id: leadId }, data: { cartaStatus: "PROCESSING" } });

  // Safety timeout: if pipeline hangs, mark as FAILED
  const pipelineTimeout = setTimeout(async () => {
    console.error(`[Pipeline] Timeout for lead ${leadId} — marking FAILED`);
    await prisma.lead.update({ where: { id: leadId }, data: { cartaStatus: "FAILED" } }).catch(() => {});
  }, 240000); // 4 minutes

  try {
    const providerName = lead.detectedProvider?.name || null;
    const extraction = await extractMenu(lead.cartaUrl, providerName);

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

    clearTimeout(pipelineTimeout);

    // Mark lead as READY and link to restaurant
    await prisma.lead.update({
      where: { id: leadId },
      data: { cartaStatus: "READY", generatedSlug: restaurant.slug, readyAt: new Date() },
    });

    console.log(`[Pipeline] Lead ${leadId} processed: ${restaurant.name} → ${cartaUrl} (${createdDishes.length} dishes)`);

    // Send email with carta link
    if (lead.email) {
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
