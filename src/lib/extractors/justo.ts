import * as cheerio from "cheerio";
import type { ExtractionResult, ExtractedDish } from "./types";

/**
 * Extract menu data from a Justo-powered restaurant website.
 * Justo uses Remix SSR — menu data is in the HTML of the /pedir page.
 *
 * Structure:
 * - Categories: sections with h2/h3 headers
 * - Dishes: <a href="/pedir/{id}/{slug}"> containing h4 (name), p (desc), span (price), img (photo)
 * - Images: https://tofuu.getjusto.com/orioneat-local/resized2/{id}-x-300.webp
 */

/** Fetch the /pedir page HTML from a Justo site */
async function fetchMenuPage(baseUrl: string): Promise<string> {
  // Normalize URL to get the /pedir page
  const url = new URL(baseUrl);
  url.pathname = "/pedir";
  url.search = "";
  url.hash = "";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  const res = await fetch(url.toString(), {
    signal: controller.signal,
    headers: { "User-Agent": "QuieroComer-Bot/1.0" },
    redirect: "follow",
  });
  clearTimeout(timeout);

  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}

/** Parse price string like "$3.590" or "$ 3.590" to integer 3590 */
function parsePrice(raw: string): number {
  const cleaned = raw.replace(/[^0-9]/g, "");
  return parseInt(cleaned, 10) || 0;
}

/** Upgrade image URL to higher resolution */
function upgradeImageUrl(url: string): string {
  // Replace -x-300 or -300-x with -x-600 for better quality
  return url.replace(/-x-300\.webp/, "-x-600.webp").replace(/-300-x\.webp/, "-600-x.webp");
}

export async function extractJusto(cartaUrl: string): Promise<ExtractionResult> {
  const html = await fetchMenuPage(cartaUrl);
  const $ = cheerio.load(html);

  // Extract restaurant name from title or meta
  const restaurantName =
    $('meta[property="og:site_name"]').attr("content") ||
    $("title").text().split("|")[0]?.trim().split("-")[0]?.trim() ||
    "Restaurante";

  // Extract logo
  const logoUrl =
    $('link[rel="apple-touch-icon"]').attr("href") ||
    $('link[rel="icon"]').attr("href") ||
    null;

  // Find all product links — Justo uses /pedir/{id}/{slug} pattern
  const dishes: ExtractedDish[] = [];
  let currentCategory = "General";

  // Justo structure:
  // - Category buttons: <button id="cat-button-{id}">Category Name</button>
  // - Category sections: <div id="cat-{id}"> containing product links

  // First pass: map category IDs to names from buttons
  const categoryNames = new Map<string, string>();
  $('[id^="cat-button-"]').each((_, el) => {
    const id = ($(el).attr("id") || "").replace("cat-button-", "");
    const name = $(el).text().trim();
    if (id && name) categoryNames.set(id, name);
  });

  // Also try h3 tags inside category anchor links
  if (categoryNames.size === 0) {
    $('a[href*="#cat-"]').each((_, el) => {
      const href = $(el).attr("href") || "";
      const catId = href.split("#cat-")[1];
      const name = $(el).find("h3").text().trim() || $(el).text().trim();
      if (catId && name) categoryNames.set(catId, name);
    });
  }

  // Second pass: extract dishes from each category section div
  $('div[id^="cat-"]').each((_, section) => {
    const rawId = $(section).attr("id") || "";
    const catId = rawId.replace("cat-", "");
    currentCategory = categoryNames.get(catId) || "General";

    $(section).find('a[href^="/pedir/"]').each((_, link) => {
      const dish = extractDishFromLink($, $(link), currentCategory);
      if (dish) dishes.push(dish);
    });
  });

  // Fallback: if structured extraction found nothing, grab all product links
  if (dishes.length === 0) {
    $('a[href^="/pedir/"]').each((_, link) => {
      const dish = extractDishFromLink($, $(link), "General");
      if (dish) dishes.push(dish);
    });
  }

  // Deduplicate by name (Justo sometimes shows featured items twice)
  const seen = new Set<string>();
  const uniqueDishes = dishes.filter((d) => {
    const key = `${d.name}|${d.price}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    restaurantName,
    dishes: uniqueDishes,
    logoUrl,
    bannerUrl: null,
  };
}

function extractDishFromLink(
  $: cheerio.CheerioAPI,
  link: cheerio.Cheerio<any>,
  category: string,
): ExtractedDish | null {
  const href = link.attr("href") || "";
  if (!href.startsWith("/pedir/") || href === "/pedir") return null;

  // Name: try h4, then img title, then first span
  const name =
    link.find("h4").first().text().trim() ||
    link.find("img").first().attr("title")?.trim() ||
    link.find("span").first().text().trim() ||
    "";

  if (!name) return null;

  // Price: search all text for $X.XXX pattern
  const allText = link.text();
  const priceMatch = allText.match(/\$[\d.,]+/);
  const price = priceMatch ? parsePrice(priceMatch[0]) : 0;

  // Description: first <p> tag
  const description = link.find("p").first().text().trim();

  // Image: first <img> with src from tofuu or any product image
  let imageUrl: string | null = null;
  link.find("img").each((_, img) => {
    const src = $(img).attr("src") || "";
    if (src.includes("tofuu.getjusto.com") && !imageUrl) {
      imageUrl = upgradeImageUrl(src);
    }
  });

  // Skip if no meaningful data
  if (!name || price === 0) return null;

  return { name, description, price, imageUrl, category };
}
