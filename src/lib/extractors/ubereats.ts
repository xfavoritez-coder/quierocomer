import type { ExtractionResult, ExtractedDish } from "./types";

/**
 * Extract menu from UberEats using their internal API.
 * URL format: ubereats.com/cl/store/{slug}/{uuid}
 * API: POST /_p/api/getStoreV1 with { storeUuid }
 */

function extractUuid(cartaUrl: string): string | null {
  // URL: https://www.ubereats.com/cl/store/santa-hamburguesa/u16k23NuWl2pe270P151tw
  // UUID is the last path segment (base64-like)
  try {
    const url = new URL(cartaUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    // Pattern: /cl/store/{slug}/{uuid}
    const storeIdx = parts.indexOf("store");
    if (storeIdx >= 0 && parts.length > storeIdx + 2) {
      return parts[storeIdx + 2].split("?")[0];
    }
  } catch {}
  return null;
}

export async function extractUberEats(cartaUrl: string): Promise<ExtractionResult> {
  const encodedUuid = extractUuid(cartaUrl);
  if (!encodedUuid) throw new Error("Could not extract UberEats store UUID from URL");

  // Decode the base64url UUID
  const decoded = Buffer.from(encodedUuid, "base64url");
  const uuid = [
    decoded.toString("hex", 0, 4),
    decoded.toString("hex", 4, 6),
    decoded.toString("hex", 6, 8),
    decoded.toString("hex", 8, 10),
    decoded.toString("hex", 10, 16),
  ].join("-");

  console.log("[UberEats] Fetching store:", uuid);

  const res = await fetch("https://www.ubereats.com/_p/api/getStoreV1", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-csrf-token": "x" },
    body: JSON.stringify({ storeUuid: uuid }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`UberEats API error: ${res.status}`);

  const { data } = await res.json();
  if (!data) throw new Error("No data from UberEats API");

  const restaurantName = data.title || "Restaurante";
  const logoUrl = data.heroImageUrls?.[0]?.url || null;

  const dishes: ExtractedDish[] = [];

  for (const sections of Object.values(data.catalogSectionsMap || {})) {
    if (!Array.isArray(sections)) continue;
    for (const sec of sections) {
      const payload = (sec as any).payload?.standardItemsPayload;
      if (!payload) continue;
      const category = payload.title?.text || "General";
      const items = payload.catalogItems || [];
      for (const item of items) {
        if (!item.title || !item.price) continue;
        dishes.push({
          name: item.title,
          description: item.itemDescription || "",
          price: Math.round(item.price / 100), // cents to CLP
          imageUrl: item.imageUrl || null,
          category,
        });
      }
    }
  }

  console.log("[UberEats] Extracted:", dishes.length, "dishes from", restaurantName);

  return {
    restaurantName,
    dishes,
    logoUrl,
    bannerUrl: null,
  };
}
