import type { ExtractionResult, ExtractedDish } from "./types";

/**
 * Extract menu from MiCartaQR (micartaqr.cl).
 * Data is in HTML data attributes: data-name, data-price, data-description, data-image-url.
 * Categories are in accordion card-title elements.
 */
export async function extractMiCartaQR(cartaUrl: string): Promise<ExtractionResult> {
  console.log("[MiCartaQR] Fetching:", cartaUrl);

  const res = await fetch(cartaUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; QuieroComer/1.0)" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Failed to fetch ${cartaUrl}: ${res.status}`);
  const html = await res.text();

  // Extract restaurant name from <title>
  const titleMatch = html.match(/<title>\s*(.+?)\s*-\s*Mi Carta Qr\s*<\/title>/i);
  const restaurantName = titleMatch ? titleMatch[1].trim() : "Restaurante";

  // Extract logo
  const logoMatch = html.match(/class="[^"]*logo[^"]*"[^>]*src="([^"]+)"/i)
    || html.match(/src="(https:\/\/www\.micartaqr\.cl\/storage\/logo\/[^"]+)"/i);
  const logoUrl = logoMatch ? logoMatch[1] : null;

  // Extract banner
  const bannerMatch = html.match(/src="(https:\/\/www\.micartaqr\.cl\/storage\/banner\/[^"]+)"/i);
  const bannerUrl = bannerMatch ? bannerMatch[1] : null;

  const dishes: ExtractedDish[] = [];
  const defaultImg = "https://www.micartaqr.cl/storage/menu/default.png";

  // Find categories: <a class="card-title">CATEGORY NAME</a> followed by menu items
  // Each category is an accordion card with items inside its collapse body
  const categoryPattern = /<a[^>]*class="card-title"[^>]*>([\s\S]*?)<\/a>/gi;
  const categoryNames: string[] = [];
  let match;
  while ((match = categoryPattern.exec(html)) !== null) {
    categoryNames.push(match[1].replace(/<[^>]+>/g, "").trim());
  }

  // Extract items from data attributes in .section-menu divs
  const itemPattern = /class="[^"]*section-menu[^"]*"[^>]*data-id="(\d+)"[^>]*data-name="([^"]*)"[^>]*data-price="([^"]*)"[^>]*data-amount="(\d+)"[^>]*data-description="([^"]*)"[^>]*data-image-url="([^"]*)"/gi;

  // Map category IDs to names by finding which collapse contains which items
  // Categories use: <div id="collapseXX" class="card-body collapse" data-parent="#accordionYY">
  // We track the accordion structure: menu-category-XX maps to a category
  const categoryDivPattern = /<div[^>]*class="card-body[^"]*menu-category-item[^"]*menu-category-(\d+)"[^>]*>/gi;
  const categoryIdToItems: Record<string, string[]> = {};
  let catMatch;

  // Simpler approach: split HTML by card-title to group items by category
  const sections = html.split(/<a[^>]*class="card-title"[^>]*>/i);

  for (let i = 1; i < sections.length; i++) {
    const categoryName = categoryNames[i - 1] || "General";
    const sectionHtml = sections[i];

    const sectionItemPattern = /data-name="([^"]*)"[^>]*data-price="([^"]*)"[^>]*data-amount="(\d+)"[^>]*data-description="([^"]*)"[^>]*data-image-url="([^"]*)"/gi;
    let itemMatch;
    while ((itemMatch = sectionItemPattern.exec(sectionHtml)) !== null) {
      const name = decodeHtmlEntities(itemMatch[1]).trim();
      const priceStr = itemMatch[3];
      const description = decodeHtmlEntities(itemMatch[4]).trim();
      const imageUrl = itemMatch[5];

      if (!name) continue;

      dishes.push({
        name,
        description,
        price: parseInt(priceStr, 10) || 0,
        imageUrl: imageUrl && imageUrl !== defaultImg ? imageUrl : null,
        category: formatCategory(categoryName),
      });
    }
  }

  console.log("[MiCartaQR] Extracted:", dishes.length, "dishes from", restaurantName);

  return { restaurantName, dishes, logoUrl, bannerUrl };
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&ntilde;/g, "ñ")
    .replace(/&Ntilde;/g, "Ñ")
    .replace(/&aacute;/g, "á")
    .replace(/&eacute;/g, "é")
    .replace(/&iacute;/g, "í")
    .replace(/&oacute;/g, "ó")
    .replace(/&uacute;/g, "ú");
}

function formatCategory(name: string): string {
  // "SUPREMA DE POLLO" → "Suprema de Pollo"
  return name
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\b(De|Del|La|Las|Los|El|En|Con|Y|A|Al)\b/g, (w) => w.toLowerCase())
    .replace(/^./, (c) => c.toUpperCase());
}
