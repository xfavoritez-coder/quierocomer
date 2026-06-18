import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import sharp from "sharp";
import bcrypt from "bcryptjs";
import { extractJusto } from "./justo";
import { extractGetagil } from "./getagil";
import { extractRappi } from "./rappi";
import { extractUberEats } from "./ubereats";
import { extractQueresto } from "./queresto";
import { extractMiCartaQR } from "./micartaqr";
import { extractWithScraper } from "./scrape";
import { extractOlaClick } from "./olaclick";
import { extractToteat } from "./toteat";
import { extractFromDocument } from "./document";
import { extractGoogleDrive } from "./googledrive";
import { extractHeyzine } from "./heyzine";
import { extractCanva } from "./canva";
import { extractAvocaty } from "./avocaty";
import { extractWooCommerce, isWooCommerce } from "./woocommerce";
import { detectDishFlags } from "@/lib/utils/detectDishFlags";
import { inferFlavorTags, detectCuisineTag } from "@/app/a/lib/categories";
import { logClaudeUsage } from "@/lib/costTracker";
import { classifyDishesBatched, type DishTaxonomyInput, type DishTaxonomy } from "@/lib/taxonomy-classify";
import type { ExtractionResult, ExtractedDish } from "./types"
import { findPlaceInfo } from "@/lib/google-places";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Infiere el tipo de dieta analizando ingredientes mencionados en nombre + descripción.
 * Solo se aplica cuando la IA devolvió OMNIVORE — no sobreescribe detecciones explícitas.
 *
 * Lógica:
 *  - Detecta carne/pescado/mariscos → OMNIVORE (sin cambio)
 *  - Detecta lácteos/huevo sin carne → VEGETARIAN
 *  - Detecta ingredientes vegetales explícitos, sin productos animales → VEGAN
 *  - Sin información suficiente → null (mantener OMNIVORE)
 */
function inferDietFromIngredients(name: string, description: string | null | undefined): "VEGAN" | "VEGETARIAN" | "OMNIVORE" | null {
  const text = `${name} ${description ?? ""}`.toLowerCase();

  // "veggie" en el nombre → siempre VEGETARIAN, sin importar descripción
  if (/\bveggie\b/i.test(name)) return "VEGETARIAN";

  // Carne, ave, pescado, mariscos → OMNIVORE seguro
  // Incluye nombres de platos que implican carne por defecto (hamburguesa, asado, parrilla, etc.)
  // a menos que la descripción indique lo contrario (tofu, lentejas, veggie) — eso se filtra luego
  // "truto"/"tuto" son alias locales de muslo/pierna de pollo
  const hasMeat = /\b(carne|res|vacuno|cerdo|chancho|pollo|ave|pavo|cordero|conejo|pato|ternera|jam[oó]n|lomo\b|churrasco|costill|filete|bife|pepperoni|salchicha|chorizo|longaniza|mortadela|prosciutto|bacon|panceta|tocino|at[uú]n|salm[oó]n|merluza|reineta|corvina|camar[oó]n|camarones|mariscos|langostino|pulpo|calamar|anchoa|sardina|alitas|mechada|nuggets?|tutos?|trutos?|hamburguesa|burger|hot.?dog|shawarma|kebab|gyros?|asado\b|parrilla|pernil|milanesa|schnitzel|rib[bs]?\b|pulled.?pork|carnitas|al\s+pastor|chicharr[oó]n|anticucho|ceviche|tiradito|sushi|ramen|pho\b|doner|meatball|albondiga|chicken|beef|pork|lamb|turkey|shrimp|seafood|fish\b|tuna\b|salmon\b|steak|wings?\b|ribs?\b|kani|kanikama|ebi\b|maguro|hamachi|hotate|unagi|tobiko|masago|ikura|tako\b|gyoza|tonkatsu|yakitori|katsu\b|gyudon|karaage|buta\b|tori\b|negitoro|spicy tuna|tekka)\b/i.test(text);
  if (hasMeat) return "OMNIVORE";

  // Lácteos, huevo, miel u otros ingredientes de origen animal (sin carne) → al menos VEGETARIAN
  // Incluye: manjar (dulce de leche), merengue (claras de huevo), gelatina (animal), miel (insecto),
  // chantilly, natilla, flan, mousse, tiramisú, panna cotta, alfajor (suelen llevar manjar/crema)
  const hasDairyOrEgg = /\b(queso|mozzarella|leche|crema\s+(?:agria|l[aá]ctea|de\s+leche)|crema\s+de\s+queso|queso\s+crema|mantequilla|manteca|huevo|huevos|yogur|yogurt|ricotta|parmesano|cheddar|gouda|brie|feta|provolone|gruy[eè]re|nata|butter|cream\s+cheese|milk|cheese\b|egg\b|eggs\b|mayonesa|mayonnaise|helado|manjar|merengue|gelatina|miel\b|chantilly|natilla|flan\b|mousse|tiramis[uú]|panna.?cotta|pannacotta|alfajor|suspiro|profiterol|mil.?hojas|cheesecake|cheescake)\b/i.test(text);
  if (hasDairyOrEgg) return "VEGETARIAN";

  // Ingredientes 100% vegetales mencionados explícitamente + descripción con suficiente detalle
  const hasPlantIngredients = /\b(tomate|salsa de tomate|cebolla|ajo|piment[oó]n|pimiento|berenjena|zapallo|calabaza|zanahoria|espinaca|lechuga|pepino|champi[nñ][oó]n|hongo|portobello|br[oó]coli|coliflor|papa|papas\s*fritas?|patata|yuca|palta|aguacate|aceituna|aceite de oliva|or[eé]gano|albahaca|cilantro|perejil|s[eé]samo|fruta|frutill|mango|pi[nñ]a|naranja|lim[oó]n|frambuesa|ar[aá]ndano|almendra|nuez|man[ií]|casta[nñ]|semilla|arroz\b|legumbre|lenteja|garbanzo|frijol|poroto|tofu|tempeh|soya|soja)\b/i.test(text);
  if (hasPlantIngredients) return "VEGAN";

  return null;
}

/** Detecta si un plato necesita un leafOverride más específico que su categoría.
 *  Ej: "Helado Frambuesa" en cat "Postres" → leafOverride = 'Helados'
 */
function detectDishLeafOverride(dishName: string): string | null {
  const n = dishName.toLowerCase();
  if (/helado|ice\s*cream|gelato|sorbete|frozen\s*yogurt|heladería/i.test(n)) return "Helados";
  return null;
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

    const meta = await sharp(buffer).metadata();
    if (!meta.format) return null;

    const { optimizeImage } = await import("@/lib/optimizeImage");
    const optimized = await optimizeImage(buffer);

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
- diet: por defecto usa OMNIVORE si no sabes con certeza. Nunca adivines VEGAN o VEGETARIAN.
- diet=OMNIVORE: cualquier plato con carne, pollo, pescado o mariscos. Hamburguesas, hot dogs, asados, pollo frito, parrilla, shawarma, sushi, ceviche, etc. → OMNIVORE aunque tengan queso o vegetales.
- diet=VEGETARIAN: SOLO si el plato claramente NO tiene carne/ave/pescado/mariscos, pero sí puede tener lácteos o huevo (pizza vegetariana, pastas sin carne, ensaladas, etc.).
- diet=VEGAN: SOLO si el plato NO tiene NINGÚN ingrediente animal (ni carne ni lácteos ni huevo ni miel). Si tienes duda → OMNIVORE.
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
  logClaudeUsage({ model: "claude-sonnet-4-6", inputTokens: data.usage?.input_tokens || 0, outputTokens: data.usage?.output_tokens || 0, action: "extract_image" });

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

  // Unsplash photo search removed — dishes display with text-only fallback
  const photoMap = new Map<string, string>();
  const creditMap = new Map<string, { photographer: string; profileUrl: string; unsplashId: string }>();

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

/** Clean tracking params from URL */
function cleanTrackingParams(url: string): string {
  try {
    const u = new URL(url);
    for (const p of ["fbclid", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) u.searchParams.delete(p);
    return u.toString();
  } catch { return url; }
}

/** Extract menu data based on detected provider */
async function extractMenu(cartaUrl: string, providerName: string | null, extractionConfig?: any): Promise<ExtractionResult> {
  // Clean tracking params before any extraction
  cartaUrl = cleanTrackingParams(cartaUrl);
  // Auto-detect provider from URL if not specified
  if (!providerName) {
    if (cartaUrl.includes('rappi.cl') || cartaUrl.includes('rappi.com')) providerName = 'Rappi'
    else if (cartaUrl.includes('ubereats.com')) providerName = 'UberEats'
    else if (cartaUrl.includes('getjusto.com') || cartaUrl.includes('/pedir')) providerName = 'Justo'
    else if (cartaUrl.includes('fu.do')) providerName = 'Fudo'
    else if (cartaUrl.includes('pedidosya.cl')) providerName = 'PedidosYa'
    else if (cartaUrl.includes('queresto.com')) providerName = 'Queresto'
    else if (cartaUrl.includes('ola.click')) providerName = 'OlaClick'
    else if (cartaUrl.includes('toteat.app')) providerName = 'Toteat'
  }
  // Route to the correct extractor
  switch (providerName) {
    case "Justo": {
      const justoResult = await extractJusto(cartaUrl)
      // Si no encontró platos y es dominio propio (no getjusto.com), intentar GetAgil
      if (justoResult.dishes.length < 3 && !cartaUrl.includes('getjusto.com')) {
        try {
          const agilResult = await extractGetagil(cartaUrl)
          if (agilResult.dishes.length >= 3) return agilResult
        } catch {}
      }
      return justoResult
    }
    case "Rappi":
      return extractRappi(cartaUrl);
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
    case "Avocaty":
      return extractAvocaty(cartaUrl);
    case "WooCommerce":
      return extractWooCommerce(cartaUrl);
    case "OlaClick":
      return extractOlaClick(cartaUrl);
    case "Toteat":
      return extractToteat(cartaUrl);
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
      // Try WooCommerce auto-detection for Web propia URLs
      if (!providerName || providerName === 'Web propia') {
        const woo = await isWooCommerce(cartaUrl).catch(() => false)
        if (woo) return extractWooCommerce(cartaUrl)
      }
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

    // Direct PDF links (e.g. .pdf URLs) → treat as document, not scrape
    const isDirectPdf = !isFileUpload && lead.cartaUrl && /\.pdf(\?|$)/i.test(lead.cartaUrl);

    let extraction = isFileUpload
      ? (isDocument ? await extractFromDocument(lead.cartaFileUrl!, fileConfig) : await extractFromImage(lead.cartaFileUrl!))
      : isDirectPdf
        ? await extractFromDocument(lead.cartaUrl!, null)
        : await extractMenu(lead.cartaUrl!, providerName, providerConfig);

    // If no dishes found from a URL, try discovering the real menu link on the page
    if (extraction.dishes.length === 0 && lead.cartaUrl && !isFileUpload && !isDirectPdf) {
      const { discoverMenuUrl } = await import("./scrape");
      const discoveredUrl = await discoverMenuUrl(lead.cartaUrl);
      if (discoveredUrl) {
        console.log(`[Pipeline] No dishes at original URL. Discovered menu URL: ${discoveredUrl} — retrying`);
        // Update lead with the real menu URL
        await prisma.lead.update({ where: { id: leadId }, data: { cartaUrl: discoveredUrl } });
        extraction = await extractMenu(discoveredUrl, providerName, providerConfig);
      }
    }

    if (extraction.dishes.length === 0) {
      throw new Error("No dishes extracted from the menu");
    }

    // Validate extraction quality — only reject if truly empty
    const dishesWithPrice = extraction.dishes.filter(d => d.price > 0);
    if (extraction.dishes.length < 3) {
      throw new Error(`Low quality extraction: ${extraction.dishes.length} dishes, ${dishesWithPrice.length} with price`);
    }
    // Log warning but don't reject if no prices (some menus/flyers don't have prices)
    if (dishesWithPrice.length === 0) {
      console.log(`[Pipeline] Warning: ${extraction.dishes.length} dishes but 0 with price — accepting anyway`);
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

    // If restaurant already exists with this slug
    if (existingRest) {
      if (existingRest.isDemo) {
        // Demo restaurant from a previous (possibly deleted) lead — wipe old data and rebuild
        console.log(`[Pipeline] Demo restaurant "${slug}" already exists — wiping old data and rebuilding (${existingRest.id})`);
        await prisma.dish.deleteMany({ where: { restaurantId: existingRest.id } });
        await prisma.category.deleteMany({ where: { restaurantId: existingRest.id } });
        await prisma.restaurant.update({
          where: { id: existingRest.id },
          data: {
            name: cleanedName,
            logoUrl: extraction.logoUrl,
            website: lead.cartaUrl,
            isDemo: true,
            isActive: true,
          },
        });
        // Continue below to create categories/dishes/owner for this restaurant
      } else {
        // Active (non-demo) restaurant — don't touch it, just link the lead
        console.log(`[Pipeline] Restaurant "${slug}" already exists and is active — reusing (${existingRest.id})`);
        await prisma.lead.update({ where: { id: leadId }, data: { generatedSlug: slug, cartaStatus: "READY", readyAt: new Date() } });
        clearTimeout(pipelineTimeout);
        const url = `${process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl"}/qr/${slug}`;
        return { slug, url };
      }
    }

    // Create restaurant or reuse wiped demo
    const restaurant = existingRest?.isDemo
      ? existingRest
      : await prisma.restaurant.create({
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
            qrActivatedAt: new Date(),
            plan: "PREMIUM",
            subscriptionStatus: "NONE",
            waiterPanelActive: true,
            menuImported: true,
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
    const taxonomyInputs: DishTaxonomyInput[] = [];
    let catPosition = 0;

    for (const [catName, catDishes] of categoryMap) {
      const category = await prisma.category.create({
        data: {
          restaurantId: restaurant.id,
          name: catName,
          position: catPosition++,
          dishType: detectDishType(catName),
          isActive: true,
          cuisineTag: detectCuisineTag(catName) ?? undefined,
        },
      });

      const isDrinkCat = category.dishType === "drink" || /caf[eé]|t[eé]\b|infusi[oó]n|bebida|bebestible|jugo|trago/i.test(catName);
      const isVeganCat = /\bvegan(?:a|o|as|os)?\b|plant.based/i.test(catName);
      const isVeggieCat = !isVeganCat && /\bveget[ae]rian[ao]?\b|veggie\b|verde\b|sin carne|solo vegetal|plant/i.test(catName);

      for (let j = 0; j < catDishes.length; j++) {
        const dish = catDishes[j];
        const detected = detectDishFlags({ name: dish.name, description: dish.description, ingredients: "" });

        const dishDietFromAI = (dish as any).diet && ["VEGAN", "VEGETARIAN"].includes((dish as any).diet) ? (dish as any).diet : "OMNIVORE";
        const dishNameText = `${dish.name} ${dish.description ?? ''}`;
        const isVeganDish = /\bvegan(?:a|o|as|os)?\b|plant.based/i.test(dishNameText);
        const isVeggieDish = !isVeganDish && /\bveget[ae]rian[ao]?\b|vegetariano|veggie\b|sin carne/i.test(dishNameText);
        // Siempre inferir desde ingredientes — puede corregir al AI si detecta carne/lácteos
        const inferredDiet = inferDietFromIngredients(dish.name, dish.description);
        const dishDiet = isDrinkCat ? "OMNIVORE"
          : (isVeganCat || isVeganDish) ? "VEGAN"
          : (isVeggieCat || isVeggieDish) ? "VEGETARIAN"  // categoría veggie gana sobre ingredientes inferidos
          : inferredDiet === "OMNIVORE" ? "OMNIVORE"
          : inferredDiet === "VEGETARIAN" && dishDietFromAI === "VEGAN" ? "VEGETARIAN"
          : dishDietFromAI !== "OMNIVORE" ? dishDietFromAI
          : (inferredDiet ?? "OMNIVORE");
        const flavorTags = isDrinkCat ? [] : inferFlavorTags(dish.name, catName, dish.description ?? null);
        const leafOverride = detectDishLeafOverride(dish.name);

        const created = await prisma.dish.create({
          data: {
            restaurantId: restaurant.id,
            categoryId: category.id,
            name: dish.name.trim(),
            description: dish.description || null,
            price: dish.price,
            photos: [],
            position: j,
            dishDiet,
            isSpicy: (dish as any).isSpicy || detected.isSpicy,
            tags: j === 0 && catPosition <= 2 ? ["RECOMMENDED"] : [],
            containsNuts: isDrinkCat ? false : detected.containsNuts,
            isGlutenFree: isDrinkCat ? false : detected.isGlutenFree,
            isLactoseFree: isDrinkCat ? false : detected.isLactoseFree,
            isSoyFree: isDrinkCat ? false : detected.isSoyFree,
            flavorTags,
            isActive: true,
            ...(leafOverride ? { leafOverride } : {}),
          },
        });

        createdDishes.push({
          id: created.id,
          name: created.name,
          description: created.description,
          externalPhoto: dish.imageUrl,
          credit: dish.photoCredit || null,
        });

        taxonomyInputs.push({
          id: created.id,
          name: created.name,
          description: created.description,
          category: catName,
        });
      }
    }

    // Mark lead as READY early — before slow operations (photos, translations)
    // so a timeout won't mark it FAILED after the restaurant already exists
    const cartaUrl = `https://quierocomer.cl/qr/${restaurant.slug}`;
    await prisma.lead.update({
      where: { id: leadId },
      data: { cartaStatus: "READY", generatedSlug: restaurant.slug, readyAt: new Date() },
    });
    clearTimeout(pipelineTimeout);
    console.log(`[Pipeline] Lead ${leadId} READY: ${restaurant.name} → ${cartaUrl} (${createdDishes.length} dishes)`);

    // Taxonomy classification — corre DESPUÉS de READY en el mismo pipeline
    // El usuario ya ve el restaurante como importado; reporta progreso por batch
    if (taxonomyInputs.length > 0) {
      try {
        const BATCH = 30;
        const batches: typeof taxonomyInputs[] = [];
        for (let i = 0; i < taxonomyInputs.length; i += BATCH) batches.push(taxonomyInputs.slice(i, i + BATCH));
        const CONCURRENCY = 4;
        const allTaxonomy: Record<string, import("@/lib/taxonomy-classify").DishTaxonomy> = {};
        let classified = 0;

        console.log(`[Pipeline] Taxonomy: clasificando ${taxonomyInputs.length} platos...`);

        for (let i = 0; i < batches.length; i += CONCURRENCY) {
          const group = batches.slice(i, i + CONCURRENCY);
          const results = await Promise.all(group.map(b => classifyDishesBatched(b, b.length, 1, cleanedName)));
          for (const r of results) Object.assign(allTaxonomy, r);
          classified += group.reduce((s, b) => s + b.length, 0);
        }

        const entries = Object.entries(allTaxonomy);
        if (entries.length > 0) {
          await prisma.$transaction(
            entries.map(([dishId, dims]) =>
              prisma.dish.update({
                where: { id: dishId },
                data: {
                  txDishType:   dims.dishType       ?? [],
                  txCuisine:    dims.cuisine        ?? [],
                  txMealSlot:   dims.mealSlot       ?? [],
                  txIngredient: dims.mainIngredient ?? [],
                  txEstilo:     dims.estilo         ?? [],
                  ...(dims.flavor?.length ? { flavorTags: dims.flavor } : {}),
                },
              })
            )
          );
        }
        console.log(`[Pipeline] Taxonomy: ${entries.length}/${taxonomyInputs.length} platos clasificados`);
      } catch (e) {
        console.error("[Pipeline] Taxonomy failed (non-fatal):", e);
      }
    }

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

    // Unsplash photo assignment removed — dishes display with text-only fallback

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

    await translationTask;

    // Reassign RECOMMENDED to dishes that have photos (the initial assignment happens before photos are uploaded)
    try {
      const allDishesForRec = await prisma.dish.findMany({
        where: { restaurantId: restaurant.id, isActive: true },
        orderBy: [{ category: { position: "asc" } }, { position: "asc" }],
        select: { id: true, photos: true, tags: true, category: { select: { position: true, dishType: true } } },
      });
      // Clear existing RECOMMENDED tags
      const currentRec = allDishesForRec.filter(d => d.tags?.includes("RECOMMENDED"));
      for (const d of currentRec) {
        await prisma.dish.update({ where: { id: d.id }, data: { tags: d.tags.filter(t => t !== "RECOMMENDED") } });
      }
      // Assign RECOMMENDED to first dish in first 2 non-drink categories
      const seenCats = new Set<number>();
      let assigned = 0;
      for (const d of allDishesForRec) {
        if (assigned >= 2) break;
        const catPos = d.category?.position ?? 99;
        if (seenCats.has(catPos)) continue;
        if (d.category?.dishType === "drink") { seenCats.add(catPos); continue; }
        await prisma.dish.update({ where: { id: d.id }, data: { tags: [...d.tags.filter(t => t !== "RECOMMENDED"), "RECOMMENDED"] } });
        seenCats.add(catPos);
        assigned++;
      }
    } catch (recErr) {
      console.error("[Pipeline] RECOMMENDED reassignment failed:", recErr);
    }

    // Always flag for backfill — we only translate ~30% here, full translation on activation
    await prisma.restaurant.update({ where: { id: restaurant.id }, data: { needsTranslation: true } }).catch(() => {});

    console.log(`[Pipeline] Lead ${leadId} post-processing done: photos + translations for ${restaurant.name}`);

    // Send simple "carta lista" email (just a link to the carta, no credentials)
    // The full welcome email with panel credentials is sent when the owner enters their panel.
    if (lead.email && translationOk) {
      try {
        const { sendAdminEmail, cartaListaSimpleEmailHtml } = await import("@/lib/email/sendAdminEmail");
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";
        const openPixel = `${baseUrl}/api/funnel/track/open?lid=${leadId}`;
        const clickUrl = `${baseUrl}/api/funnel/track/click?lid=${leadId}&url=${encodeURIComponent(`${baseUrl}/qr/${restaurant.slug}`)}`;
        const ownerName = (lead.ownerName || "Hola").split(" ")[0];

        await sendAdminEmail({
          to: lead.email,
          subject: `${ownerName}, tu carta de ${restaurant.name} está lista`,
          html: cartaListaSimpleEmailHtml({ ownerName, restaurantName: restaurant.name, cartaUrl: clickUrl, openPixel, dishCount: createdDishes.length, categoryCount: categoryMap.size, logoUrl: extraction.logoUrl }),
          purpose: "funnel_carta_lista",
        });

        await prisma.lead.update({ where: { id: leadId }, data: { cartaStatus: "DELIVERED", deliveredAt: new Date() } });
        console.log(`[Pipeline] Carta lista email sent to ${lead.email}`);
      } catch (emailErr) {
        console.error(`[Pipeline] Failed to send carta lista email:`, emailErr);
        // Still mark as DELIVERED so funnel progresses
        await prisma.lead.update({ where: { id: leadId }, data: { cartaStatus: "DELIVERED", deliveredAt: new Date() } }).catch(() => {});
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

    // Send WhatsApp on failure using approved template (max 2 per person)
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

        // WA fail notification disabled — se maneja manualmente desde admin si es necesario
        if (shouldNotify) {
          console.log(`[Pipeline] Fail WA disabled — would have notified ${lead.whatsapp} for lead ${leadId}`);
        }
      } catch {}
    }

    // Send help email to lead on failure
    if (lead.email) {
      try {
        const { sendLeadFailureEmail } = await import("@/lib/email/leadFailureEmail");
        await sendLeadFailureEmail({
          leadId,
          to: lead.email,
          ownerName: (lead.ownerName || "").split(" ")[0] || "Hola",
          restaurantName: lead.localName || "tu restaurante",
          errorMsg,
          cartaUrl: lead.cartaUrl || undefined,
        });
      } catch (emailErr) {
        console.error("[Pipeline] Failed to send failure email:", emailErr);
      }
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

/**
 * importFromProspecto — import a prospected place directly into the feed.
 * No Lead, no owner, no emails/WhatsApp. Creates Restaurant + Categories + Dishes.
 */
export async function importFromProspecto(params: {
  prospectoId: string
  name: string
  address: string
  lat: number | null
  lng: number | null
  mapsUrl: string
  cartaUrl: string
  providerName: string | null
  onProgress?: (type: string, data: object) => void
}): Promise<{ slug: string; dishCount: number }> {
  // Get provider config from DB if known provider
  const provider = params.providerName
    ? await prisma.menuProvider.findFirst({
        where: { name: params.providerName },
        select: { extractionConfig: true },
      })
    : null

  const extraction = await extractMenu(params.cartaUrl, params.providerName, provider?.extractionConfig)

  if (extraction.dishes.length < 3) {
    throw new Error(`Solo ${extraction.dishes.length} platos extraídos — mínimo 3`)
  }

  // Generate unique slug — strip trailing " - [place]" suffixes from Google Maps names
  const cleanedName = params.name.trim().replace(/\s*[-–]\s*(vitacura|santiago|ñuñoa|providencia|las condes|miraflores|maipú|maipu|la florida|peñalolén|macul|san miguel|recoleta|independencia|pudahuel|quilicura|renca|lo barnechea|huechuraba|conchalí|conchali|quinta normal|cerro navia|lo prado|estación central|estacion central|pedro aguirre cerda|san joaquín|san ramon|san bernardo|puente alto|la pintana|el bosque|la cisterna|lo espejo|cerrillos|buín|buin|talagante|peñaflor|chile)\s*$/i, '')
  let slug = slugify(cleanedName)
  if (!slug) slug = `local-${Date.now().toString(36)}`

  // Handle slug collision
  const existing = await prisma.restaurant.findUnique({ where: { slug } })
  if (existing) {
    if (!existing.isDemo && !existing.menuImported) {
      // Real restaurant with a real owner — don't overwrite, just link prospecto
      await prisma.mapaProspecto.update({
        where: { id: params.prospectoId },
        data: { importedSlug: slug },
      })
      return { slug, dishCount: 0 }
    }
    // Demo or previously auto-imported — wipe and rebuild
    await prisma.dish.deleteMany({ where: { restaurantId: existing.id } })
    await prisma.category.deleteMany({ where: { restaurantId: existing.id } })
    await prisma.restaurant.update({
      where: { id: existing.id },
      data: { name: cleanedName, logoUrl: extraction.logoUrl, website: params.cartaUrl, isActive: true, isDemo: false, menuImported: true },
    })
  }

  const restaurant = existing
    ?? await prisma.restaurant.create({
        data: {
          name: cleanedName,
          slug,
          address: params.address || null,
          lat: params.lat ?? null,
          lng: params.lng ?? null,
          website: params.cartaUrl,
          logoUrl: extraction.logoUrl ?? null,
          cartaTheme: "PREMIUM",
          cartaColorMode: "DARK",
          defaultView: "lista",
          enabledLangs: ["es", "en", "pt"],
          isActive: true,
          isDemo: false,
          menuImported: true,
          plan: "PREMIUM",
          qrActivatedAt: new Date(),
        },
      })

  // Enrich with Google Places data if we have lat/lng
  if (params.lat && params.lng) {
    try {
      const placeInfo = await findPlaceInfo(cleanedName, params.lat, params.lng)
      if (placeInfo) {
        await (prisma.restaurant.update as any)({
          where: { id: restaurant.id },
          data: {
            googlePlaceId: placeInfo.placeId,
            googleMapsUrl: placeInfo.mapsUrl,
            googleRating: placeInfo.rating,
            googleRatingCount: placeInfo.ratingCount,
            ...(placeInfo.scheduleJson ? { scheduleJson: placeInfo.scheduleJson } : {}),
          },
        })
      }
    } catch (err) {
      console.warn(`[Pipeline] Google Places lookup failed for ${cleanedName}:`, err)
    }
  }

  // Create categories + dishes — batch inserts to avoid timeout with large menus
  const categoryMap = new Map<string, typeof extraction.dishes>()
  for (const dish of extraction.dishes) {
    const cat = dish.category || "General"
    if (!categoryMap.has(cat)) categoryMap.set(cat, [])
    categoryMap.get(cat)!.push(dish)
  }

  // 1. Create all categories in one transaction
  const catEntries = [...categoryMap.entries()]
  const createdCategories = await prisma.$transaction(
    catEntries.map(([catName, _], position) =>
      prisma.category.create({
        data: {
          restaurantId: restaurant.id,
          name: catName,
          position,
          dishType: detectDishType(catName),
          isActive: true,
          cuisineTag: detectCuisineTag(catName) ?? undefined,
        },
      })
    )
  )

  // 2. Build all dish data and insert in batches of 50
  const allDishData: any[] = []
  const taxInputsTemplate: { name: string; description: string | null; category: string }[] = []
  catEntries.forEach(([catName, catDishes], catIdx) => {
    const category = createdCategories[catIdx]
    const isDrinkCat = category.dishType === "drink" || /caf[eé]|t[eé]\b|infusi[oó]n|bebida|bebestible|jugo|trago/i.test(catName)
    const isVeganCat = /\bvegan(?:a|o|as|os)?\b|plant.based/i.test(catName)
    const isVeggieCat = !isVeganCat && /\bveget[ae]rian[ao]?\b|veggie\b|verde\b|sin carne|solo vegetal|plant/i.test(catName)
    catDishes.forEach((dish, j) => {
      const detected = detectDishFlags({ name: dish.name, description: dish.description, ingredients: "" })
      const dishDietFromAI = (dish as any).diet && ["VEGAN", "VEGETARIAN"].includes((dish as any).diet) ? (dish as any).diet : "OMNIVORE"
      const dishNameText = `${dish.name} ${dish.description ?? ''}`
      const isVeganDish = /\bvegan(?:a|o|as|os)?\b|plant.based/i.test(dishNameText)
      const isVeggieDish = !isVeganDish && /\bveget[ae]rian[ao]?\b|vegetariano|veggie\b|sin carne/i.test(dishNameText)
      // Siempre inferir desde ingredientes — puede corregir al AI si detecta carne/lácteos
      const inferredDiet = inferDietFromIngredients(dish.name, dish.description)
      const dishDiet = isDrinkCat ? "OMNIVORE"
        : (isVeganCat || isVeganDish) ? "VEGAN"
        : (isVeggieCat || isVeggieDish) ? "VEGETARIAN"  // categoría veggie gana sobre ingredientes inferidos
        : inferredDiet === "OMNIVORE" ? "OMNIVORE"
        : inferredDiet === "VEGETARIAN" && dishDietFromAI === "VEGAN" ? "VEGETARIAN"
        : dishDietFromAI !== "OMNIVORE" ? dishDietFromAI
        : (inferredDiet ?? "OMNIVORE")
      const flavorTags = isDrinkCat ? [] : inferFlavorTags(dish.name, catName, dish.description ?? null)
      const leafOverride = detectDishLeafOverride(dish.name)
      taxInputsTemplate.push({ name: dish.name.trim(), description: dish.description || null, category: catName })
      allDishData.push({
        restaurantId: restaurant.id,
        categoryId: category.id,
        name: dish.name.trim(),
        description: dish.description || null,
        price: dish.price,
        photos: dish.imageUrl ? [upgradePhotoUrl(dish.imageUrl)] : [],
        position: j,
        dishDiet,
        isSpicy: (dish as any).isSpicy || detected.isSpicy,
        tags: j === 0 && catIdx <= 1 ? ["RECOMMENDED"] : [],
        containsNuts: isDrinkCat ? false : detected.containsNuts,
        isGlutenFree: isDrinkCat ? false : detected.isGlutenFree,
        isLactoseFree: isDrinkCat ? false : detected.isLactoseFree,
        isSoyFree: isDrinkCat ? false : detected.isSoyFree,
        flavorTags,
        isActive: true,
        ...(leafOverride ? { leafOverride } : {}),
      })
    })
  })

  const BATCH = 50
  const allCreatedDishes: { id: string }[] = []
  for (let i = 0; i < allDishData.length; i += BATCH) {
    const created = await prisma.$transaction(
      allDishData.slice(i, i + BATCH).map(data => prisma.dish.create({ data, select: { id: true } }))
    )
    allCreatedDishes.push(...created)
  }

  const dishCount = allDishData.length

  // Update prospecto with generated slug
  await prisma.mapaProspecto.update({
    where: { id: params.prospectoId },
    data: { importedSlug: slug },
  })

  // Taxonomy classification con progress streaming
  if (allCreatedDishes.length > 0) {
    try {
      const taxonomyInputs: DishTaxonomyInput[] = allCreatedDishes.map((d, i) => ({
        id: d.id,
        name: taxInputsTemplate[i]?.name ?? '',
        description: taxInputsTemplate[i]?.description ?? null,
        category: taxInputsTemplate[i]?.category ?? '',
      }))
      const TAX_BATCH = 30
      const batches: DishTaxonomyInput[][] = []
      for (let i = 0; i < taxonomyInputs.length; i += TAX_BATCH) batches.push(taxonomyInputs.slice(i, i + TAX_BATCH))
      const CONCURRENCY = 4
      const allTaxonomy: Record<string, DishTaxonomy> = {}
      let classified = 0

      params.onProgress?.('taxonomy_start', { total: taxonomyInputs.length })

      for (let i = 0; i < batches.length; i += CONCURRENCY) {
        const group = batches.slice(i, i + CONCURRENCY)
        const results = await Promise.all(group.map(b => classifyDishesBatched(b, b.length, 1, params.name)))
        for (const r of results) Object.assign(allTaxonomy, r)
        classified += group.reduce((s, b) => s + b.length, 0)
        params.onProgress?.('taxonomy_progress', { current: Math.min(classified, taxonomyInputs.length), total: taxonomyInputs.length })
      }

      const entries = Object.entries(allTaxonomy)
      if (entries.length > 0) {
        await prisma.$transaction(
          entries.map(([dishId, dims]) =>
            prisma.dish.update({
              where: { id: dishId },
              data: {
                txDishType:   dims.dishType       ?? [],
                txCuisine:    dims.cuisine        ?? [],
                txMealSlot:   dims.mealSlot       ?? [],
                txIngredient: dims.mainIngredient ?? [],
                txEstilo:     dims.estilo         ?? [],
                ...(dims.flavor?.length ? { flavorTags: dims.flavor } : {}),
              },
            })
          )
        )
      }
      params.onProgress?.('taxonomy_done', { classified: entries.length, total: taxonomyInputs.length })
      console.log(`[importFromProspecto] Taxonomy: ${entries.length}/${taxonomyInputs.length} platos`)
    } catch (e) {
      console.error('[importFromProspecto] Taxonomy failed (non-fatal):', e)
      params.onProgress?.('taxonomy_error', { error: (e as any)?.message ?? 'Error' })
    }
  }

  return { slug, dishCount }
}
