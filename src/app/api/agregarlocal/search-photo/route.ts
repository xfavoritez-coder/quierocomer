import { NextResponse } from "next/server";
import { fetchRandomUnsplashPhotos, type UnsplashPhoto } from "@/lib/unsplash";

const UNSPLASH_MAX = 30;

// Batch endpoint: fetch N random food photos (splits into multiple calls if >30)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const count = Math.min(Number(searchParams.get("count")) || 1, 50);
  if (!process.env.UNSPLASH_ACCESS_KEY) return NextResponse.json({ urls: [], error: "No API key" });

  try {
    let photos: UnsplashPhoto[];
    if (count <= UNSPLASH_MAX) {
      photos = await fetchRandomUnsplashPhotos("food dish restaurant", count);
    } else {
      const [batch1, batch2] = await Promise.all([
        fetchRandomUnsplashPhotos("food dish restaurant", UNSPLASH_MAX),
        fetchRandomUnsplashPhotos("food dish restaurant", count - UNSPLASH_MAX),
      ]);
      photos = [...batch1, ...batch2];
    }
    return NextResponse.json({
      urls: photos.map(p => p.url),
      photos, // full metadata for clients that need credits
    });
  } catch (e: any) {
    return NextResponse.json({ urls: [], error: e.message });
  }
}
