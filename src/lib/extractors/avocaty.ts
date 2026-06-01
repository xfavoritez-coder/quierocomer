/**
 * Extractor para carta.avocaty.io (AlaCartaDigital)
 *
 * Estructura: Next.js SSR con __NEXT_DATA__ que contiene:
 * - catalog.menuIds → menusById → sectionsById → elementsById
 * - Campos: menu.title, section.header, element.displayName
 * - Precios en element.priceColumnValues o element.basePrice
 * - Fotos en element.image.url
 * - Logo en restaurant.logoImageUrl
 */
import type { ExtractionResult, ExtractedDish } from "./types";

interface AvocatyElement {
  id: string;
  displayName: string;
  description?: string;
  image?: { url?: string; name?: string } | null;
  additionalImages?: { url?: string }[];
  priceColumnValues?: string[];
  basePrice?: number | string | null;
  type?: string;
  highlighted?: boolean;
  allergens?: string[];
  flags?: string[];
}

interface AvocatySection {
  id: string;
  header: string;
  description?: string;
  elementIds: string[];
  priceColumnHeaders?: string[];
}

interface AvocatyMenu {
  id: string;
  title: string;
  sectionIds: string[];
  image?: { url?: string } | null;
}

interface AvocatyCatalog {
  menuIds: string[];
  menusById: Record<string, AvocatyMenu>;
  sectionsById: Record<string, AvocatySection>;
  elementsById: Record<string, AvocatyElement>;
}

export async function extractAvocaty(cartaUrl: string): Promise<ExtractionResult> {
  const res = await fetch(cartaUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; QuieroComer/1.0)" },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`Avocaty fetch failed: ${res.status}`);

  const html = await res.text();

  // Extract __NEXT_DATA__
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw new Error("No __NEXT_DATA__ found in Avocaty page");

  const nextData = JSON.parse(match[1]);
  const pageProps = nextData.props?.pageProps;
  if (!pageProps) throw new Error("No pageProps in Avocaty data");

  const catalog: AvocatyCatalog = pageProps.catalog;
  const restaurant = pageProps.restaurant;

  if (!catalog?.menuIds?.length) throw new Error("No menus in Avocaty catalog");

  const restaurantName = restaurant?.displayName || "Restaurante";
  const logoUrl = restaurant?.logoImageUrl || null;
  const bannerUrl = restaurant?.coverImageUrl || null;

  const dishes: ExtractedDish[] = [];

  // Iterate all menus → sections → elements
  for (const menuId of catalog.menuIds) {
    const menu = catalog.menusById[menuId];
    if (!menu) continue;

    for (const sectionId of menu.sectionIds || []) {
      const section = catalog.sectionsById[sectionId];
      if (!section) continue;

      const categoryName = section.header || menu.title || "General";

      for (const elementId of section.elementIds || []) {
        const el = catalog.elementsById[elementId];
        if (!el || !el.displayName) continue;

        // Parse price: try priceColumnValues first, then basePrice
        let price: number | null = null;
        if (el.priceColumnValues?.length) {
          for (const pv of el.priceColumnValues) {
            const parsed = parsePrice(pv);
            if (parsed !== null) {
              price = parsed;
              break;
            }
          }
        }
        if (price === null && el.basePrice) {
          price = typeof el.basePrice === "string" ? parsePrice(el.basePrice) : el.basePrice;
        }

        // Get photo
        const photo = el.image?.url || el.additionalImages?.[0]?.url || null;

        dishes.push({
          name: el.displayName.trim(),
          description: el.description?.trim() || "",
          price: price ?? 0,
          imageUrl: photo,
          category: categoryName,
        });
      }
    }
  }

  return {
    restaurantName,
    dishes,
    logoUrl,
    bannerUrl,
  };
}

function parsePrice(val: string | null | undefined): number | null {
  if (!val) return null;
  // Remove currency symbols, dots as thousands separator, etc.
  const cleaned = val.replace(/[^0-9.,]/g, "").trim();
  if (!cleaned) return null;
  // Chilean format: 2.500 = 2500, or 2500
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(normalized);
  return isNaN(num) ? null : num;
}
