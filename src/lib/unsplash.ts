/**
 * Unsplash API helpers — centralized to comply with Unsplash guidelines:
 * 1. Hotlink to original URLs (images.unsplash.com)
 * 2. Trigger download endpoint when a photo is "used"
 * 3. Return photographer attribution data
 *
 * We use urls.raw + Imgix params for optimal performance:
 *   ?w=800&q=80&fm=webp&fit=crop&crop=entropy
 * This lets Unsplash's CDN serve optimized WebP at the exact size we need,
 * no re-upload to our storage required.
 */

const UNSPLASH_KEY = () => process.env.UNSPLASH_ACCESS_KEY;

/** Imgix params appended to raw Unsplash URLs for optimal delivery */
const PHOTO_PARAMS_CARD = "w=600&q=80&fm=webp&fit=crop&crop=entropy&auto=compress";
const PHOTO_PARAMS_DETAIL = "w=1080&q=82&fm=webp&fit=crop&crop=entropy&auto=compress";
const PHOTO_PARAMS_HERO = "w=1200&q=85&fm=webp&fit=crop&crop=entropy&auto=compress";

/**
 * Build an optimized Unsplash URL from the raw base URL.
 * Usage: optimizedUrl(rawUrl, "card") → 600px WebP
 */
export function optimizedUnsplashUrl(rawUrl: string, size: "card" | "detail" | "hero" = "card"): string {
  const params = size === "hero" ? PHOTO_PARAMS_HERO : size === "detail" ? PHOTO_PARAMS_DETAIL : PHOTO_PARAMS_CARD;
  const sep = rawUrl.includes("?") ? "&" : "?";
  return `${rawUrl}${sep}${params}`;
}

export interface UnsplashPhoto {
  url: string;           // optimized URL (raw + params) — hotlinked to images.unsplash.com
  rawUrl: string;        // urls.raw — base URL without params
  photographer: string;  // user.name
  profileUrl: string;    // user.links.html
  unsplashId: string;    // photo id
  downloadLocation: string; // links.download_location
}

export interface PhotoCredit {
  photographer: string;
  profileUrl: string;
  unsplashId: string;
}

/**
 * Search Unsplash for a photo matching the query.
 * Returns full metadata including attribution and download trigger URL.
 */
export async function searchUnsplashPhoto(query: string, timeoutMs = 5000): Promise<UnsplashPhoto | null> {
  const key = UNSPLASH_KEY();
  if (!key) return null;

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
      {
        headers: { Authorization: `Client-ID ${key}` },
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (!res.ok) return null;

    const data = await res.json();
    const photo = data.results?.[0];
    if (!photo) return null;

    const rawUrl = photo.urls.raw;
    return {
      url: optimizedUnsplashUrl(rawUrl, "card"),
      rawUrl,
      photographer: photo.user?.name || "Unknown",
      profileUrl: photo.user?.links?.html || "https://unsplash.com",
      unsplashId: photo.unsplashId || photo.id,
      downloadLocation: photo.links?.download_location || "",
    };
  } catch {
    return null;
  }
}

/**
 * Fetch random Unsplash photos with full metadata.
 */
export async function fetchRandomUnsplashPhotos(query: string, count: number, timeoutMs = 5000): Promise<UnsplashPhoto[]> {
  const key = UNSPLASH_KEY();
  if (!key) return [];

  try {
    const res = await fetch(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&count=${count}&orientation=landscape`,
      {
        headers: { Authorization: `Client-ID ${key}` },
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (!res.ok) return [];

    const data = await res.json();
    return (Array.isArray(data) ? data : [data]).map((p: any) => {
      const rawUrl = p.urls?.raw;
      return {
        url: rawUrl ? optimizedUnsplashUrl(rawUrl, "card") : p.urls?.regular,
        rawUrl: rawUrl || p.urls?.regular,
        photographer: p.user?.name || "Unknown",
        profileUrl: p.user?.links?.html || "https://unsplash.com",
        unsplashId: p.id,
        downloadLocation: p.links?.download_location || "",
      };
    }).filter((p: UnsplashPhoto) => p.url);
  } catch {
    return [];
  }
}

/**
 * Trigger the Unsplash download endpoint.
 * Must be called when a photo is actually "used" (displayed to end user / assigned to a dish).
 * This is required by Unsplash API guidelines.
 */
export async function triggerUnsplashDownload(downloadLocation: string): Promise<void> {
  const key = UNSPLASH_KEY();
  if (!key || !downloadLocation) return;

  try {
    await fetch(downloadLocation, {
      headers: { Authorization: `Client-ID ${key}` },
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Silent fail — download trigger is best-effort
  }
}
