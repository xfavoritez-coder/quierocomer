/**
 * Unsplash API helpers — centralized to comply with Unsplash guidelines:
 * 1. Hotlink to original URLs
 * 2. Trigger download endpoint when a photo is "used"
 * 3. Return photographer attribution data
 */

const UNSPLASH_KEY = () => process.env.UNSPLASH_ACCESS_KEY;

export interface UnsplashPhoto {
  url: string;           // urls.regular — hotlinked
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

    return {
      url: photo.urls.regular,
      photographer: photo.user?.name || "Unknown",
      profileUrl: photo.user?.links?.html || "https://unsplash.com",
      unsplashId: photo.id,
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
    return (Array.isArray(data) ? data : [data]).map((p: any) => ({
      url: p.urls?.regular,
      photographer: p.user?.name || "Unknown",
      profileUrl: p.user?.links?.html || "https://unsplash.com",
      unsplashId: p.id,
      downloadLocation: p.links?.download_location || "",
    })).filter((p: UnsplashPhoto) => p.url);
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
