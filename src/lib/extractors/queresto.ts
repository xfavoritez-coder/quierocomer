import type { ExtractionResult, ExtractedDish } from "./types";

/**
 * Extract menu from Queresto/Bistrify using JSON-LD embedded in HTML.
 * No Jina or Claude needed — data is in the initial HTML.
 */
export async function extractQueresto(cartaUrl: string): Promise<ExtractionResult> {
  console.log("[Queresto] Fetching HTML:", cartaUrl);

  const res = await fetch(cartaUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; QuieroComer/1.0)" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Failed to fetch ${cartaUrl}: ${res.status}`);
  const html = await res.text();

  // Extract JSON-LD blocks
  const jsonLdBlocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];

  let restaurantName = "Restaurante";
  let logoUrl: string | null = null;
  const dishes: ExtractedDish[] = [];

  for (const block of jsonLdBlocks) {
    try {
      const data = JSON.parse(block[1]);
      if (data["@type"] !== "Restaurant") continue;

      restaurantName = data.name || restaurantName;
      logoUrl = data.image || null;

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
            price: typeof price === "number" ? price : parseInt(String(price).replace(/\D/g, ""), 10) || 0,
            imageUrl: item.image || null,
            category: categoryName,
          });
        }
      }
    } catch {}
  }

  // If JSON-LD didn't have images, try to find them in the HTML
  if (dishes.length > 0 && dishes.every((d) => !d.imageUrl)) {
    // Match w=128 thumbnail srcset entries — covers both /items/ and /images/ paths
    const imgMatches = [...html.matchAll(/https:\/\/cdn\.bistrify\.app\/cdn-cgi\/image\/w=128[^"'\s]*/gi)];
    // Extract the base image path and build an HD URL without thumbnail constraints
    const seen = new Set<string>()
    const imgUrls: string[] = []
    for (const m of imgMatches) {
      const thumbUrl = m[0].split(' ')[0] // strip trailing " 2x" from srcset
      const pathMatch = thumbUrl.match(/\/images\/(.+)$/)
      if (!pathMatch) continue
      const url = `https://cdn.bistrify.app/images/${pathMatch[1]}`
      if (!seen.has(url)) { seen.add(url); imgUrls.push(url) }
    }
    // Match images to dishes by position (best effort)
    for (let i = 0; i < Math.min(dishes.length, imgUrls.length); i++) {
      dishes[i].imageUrl = imgUrls[i]
    }
  }

  // Also upgrade any images from JSON-LD that have small CDN dimensions
  for (const d of dishes) {
    if (d.imageUrl && d.imageUrl.includes("cdn.bistrify.app/cdn-cgi/image/")) {
      // Strip the CDN transform to get the original image
      const pathMatch = d.imageUrl.match(/\/images\/(.+)$/)
      if (pathMatch) {
        d.imageUrl = `https://cdn.bistrify.app/images/${pathMatch[1]}`
      } else {
        d.imageUrl = d.imageUrl.replace(/w=\d+,h=\d+[^/]*\//, "w=800,h=800,fit=cover/")
      }
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
