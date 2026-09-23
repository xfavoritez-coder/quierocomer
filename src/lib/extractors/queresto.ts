import type { ExtractionResult, ExtractedDish } from "./types";

/**
 * Extract menu from Queresto/Bistrify.
 *
 * Strategy:
 * 1. Fetch /_payload.json (Nuxt devalue format) — this is the canonical source.
 *    Parse items using a targeted devalue dereferencer.
 * 2. Fall back to JSON-LD in the HTML if payload fails.
 *
 * Empty menu detection: the payload store object (arr[2]) has items pointing
 * to an empty array OR items field missing. We only throw "no tiene menú" if
 * the payload is valid but truly empty.
 */

/** Dereference a value from a Nuxt devalue flat array. */
function devalueGet(arr: unknown[], idx: number): unknown {
  if (idx < 0 || idx >= arr.length) return undefined;
  const val = arr[idx];
  if (val === null || typeof val !== "object") return val;
  if (
    Array.isArray(val) &&
    val.length === 2 &&
    typeof val[0] === "string" &&
    (val[0] === "Reactive" || val[0] === "ShallowReactive") &&
    typeof val[1] === "number"
  ) {
    return devalueGet(arr, val[1]);
  }
  return val;
}

function devalueObj(arr: unknown[], idx: number): Record<string, unknown> | null {
  const val = devalueGet(arr, idx);
  if (!val || typeof val !== "object" || Array.isArray(val)) return null;
  const raw = val as Record<string, unknown>;
  const resolved: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    resolved[k] = typeof v === "number" ? devalueGet(arr, v) : v;
  }
  return resolved;
}

function parseDevalueDishes(
  arr: unknown[],
): { dishes: ExtractedDish[]; hasItems: boolean } {
  if (!Array.isArray(arr) || arr.length < 4) return { dishes: [], hasItems: false };

  // Store object is always at index 2
  const storeRaw = arr[2];
  if (!storeRaw || typeof storeRaw !== "object" || Array.isArray(storeRaw))
    return { dishes: [], hasItems: false };

  const storeRef = storeRaw as Record<string, unknown>;
  const itemsRef = storeRef.items;
  if (typeof itemsRef !== "number") return { dishes: [], hasItems: false };

  const itemsArr = arr[itemsRef];
  if (!Array.isArray(itemsArr)) return { dishes: [], hasItems: false };
  if (itemsArr.length === 0) return { dishes: [], hasItems: false };

  const categoryNames = new Map<number, string>();
  let catCounter = 0;

  const dishes: ExtractedDish[] = [];
  for (const itemIdx of itemsArr) {
    if (typeof itemIdx !== "number") continue;
    const item = devalueObj(arr, itemIdx);
    if (!item) continue;

    const name = item.name as string | undefined;
    if (!name) continue;

    // Skip hidden items
    if (item.visible === false) continue;

    const description = (item.description as string | undefined) || "";
    const price =
      typeof item.discountedPrice === "number" && (item.discountedPrice as number) > 0
        ? (item.discountedPrice as number)
        : typeof item.price === "number"
        ? (item.price as number)
        : 0;

    const picture = item.picture as string | undefined | null;
    let imageUrl: string | null = null;
    if (picture && typeof picture === "string") {
      imageUrl = picture.startsWith("http")
        ? picture
        : `https://cdn.bistrify.app/${picture}`;
    }

    const catId = item.categoryId as number | undefined;
    let category = "General";
    if (typeof catId === "number") {
      if (!categoryNames.has(catId)) {
        catCounter++;
        categoryNames.set(catId, `Categoría ${catCounter}`);
      }
      category = categoryNames.get(catId)!;
    }

    dishes.push({ name: name.trim(), description, price, imageUrl, category });
  }

  return { dishes, hasItems: true };
}

export async function extractQueresto(cartaUrl: string): Promise<ExtractionResult> {
  console.log("[Queresto] Fetching payload:", cartaUrl);

  const urlObj = new URL(cartaUrl);
  const payloadUrl = `${urlObj.origin}${urlObj.pathname}/_payload.json`;

  let restaurantName = "Restaurante";
  let logoUrl: string | null = null;
  let dishes: ExtractedDish[] = [];

  // ── 1. Try /_payload.json (devalue format) ─────────────────────────────────
  try {
    const payloadRes = await fetch(payloadUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; QuieroComer/1.0)" },
      signal: AbortSignal.timeout(10000),
    }).catch(() => null);

    if (payloadRes?.ok) {
      const arr = await payloadRes.json().catch(() => null);
      if (Array.isArray(arr)) {
        const { dishes: devalueDishes, hasItems } = parseDevalueDishes(arr);
        if (!hasItems) {
          throw new Error(
            "Este restaurante no tiene menú cargado en Queresto. " +
              "Pídele al dueño que suba su carta en queresto.com, o que nos envíe la carta directamente.",
          );
        }
        dishes = devalueDishes;
        console.log("[Queresto] Parsed", dishes.length, "dishes from _payload.json");
      }
    }
  } catch (e) {
    if ((e as Error).message?.includes("no tiene menú")) throw e;
    // Payload fetch/parse failed — fall through to HTML scraping
    console.warn("[Queresto] payload parse failed:", (e as Error).message);
  }

  // ── 2. Fetch HTML for name / logo (and fallback menu via JSON-LD) ──────────
  const res = await fetch(cartaUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; QuieroComer/1.0)" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Failed to fetch ${cartaUrl}: ${res.status}`);
  const html = await res.text();

  // Extract JSON-LD blocks for name/logo (and menu if payload gave 0 dishes)
  const jsonLdBlocks = [
    ...html.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ];

  for (const block of jsonLdBlocks) {
    try {
      const data = JSON.parse(block[1]);
      if (data["@type"] !== "Restaurant") continue;

      restaurantName = data.name || restaurantName;
      logoUrl = data.image || null;

      // Only use JSON-LD menu if payload gave us nothing
      if (dishes.length === 0) {
        const menu = data.hasMenu || data.menu;
        if (!menu) continue;
        const sections = menu.hasMenuSection || [];
        for (const section of sections) {
          const categoryName = section.name || "General";
          const items = section.hasMenuItem || [];
          for (const item of items) {
            if (!item.name) continue;
            const price = item.offers?.price || item.price || 0;
            dishes.push({
              name: item.name.trim(),
              description: item.description || "",
              price:
                typeof price === "number"
                  ? price
                  : parseInt(String(price).replace(/\D/g, ""), 10) || 0,
              imageUrl: item.image || null,
              category: categoryName,
            });
          }
        }
      }
    } catch {}
  }

  // Upgrade any CDN-transformed image URLs to originals
  for (const d of dishes) {
    if (d.imageUrl && d.imageUrl.includes("cdn.bistrify.app/cdn-cgi/image/")) {
      const pathMatch = d.imageUrl.match(/\/images\/(.+)$/);
      if (pathMatch) {
        d.imageUrl = `https://cdn.bistrify.app/images/${pathMatch[1]}`;
      } else {
        d.imageUrl = d.imageUrl.replace(/w=\d+,h=\d+[^/]*\//, "w=800,h=800,fit=cover/");
      }
    }
  }

  // If JSON-LD fallback had images missing, scrape thumbnails from HTML
  if (dishes.length > 0 && dishes.every((d) => !d.imageUrl)) {
    const imgMatches = [
      ...html.matchAll(/https:\/\/cdn\.bistrify\.app\/cdn-cgi\/image\/w=128[^"'\s]*/gi),
    ];
    const seen = new Set<string>();
    const imgUrls: string[] = [];
    for (const m of imgMatches) {
      const thumbUrl = m[0].split(" ")[0];
      const pathMatch = thumbUrl.match(/\/images\/(.+)$/);
      if (!pathMatch) continue;
      const url = `https://cdn.bistrify.app/images/${pathMatch[1]}`;
      if (!seen.has(url)) {
        seen.add(url);
        imgUrls.push(url);
      }
    }
    for (let i = 0; i < Math.min(dishes.length, imgUrls.length); i++) {
      dishes[i].imageUrl = imgUrls[i];
    }
  }

  console.log("[Queresto] Extracted:", dishes.length, "dishes from", restaurantName);

  return {
    restaurantName: restaurantName.split("|")[0].split("-")[0].trim(),
    dishes,
    logoUrl,
    bannerUrl: null,
  };
}
