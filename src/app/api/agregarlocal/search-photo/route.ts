import { NextResponse } from "next/server";

const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;
const UNSPLASH_MAX = 30; // Unsplash API max per request

async function fetchRandomPhotos(count: number): Promise<string[]> {
  const res = await fetch(
    `https://api.unsplash.com/photos/random?query=food+dish+restaurant&count=${count}&orientation=landscape`,
    { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (Array.isArray(data) ? data : [data]).map((p: any) => p?.urls?.regular).filter(Boolean);
}

// Batch endpoint: fetch N random food photos (splits into multiple calls if >30)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const count = Math.min(Number(searchParams.get("count")) || 1, 50);
  if (!UNSPLASH_KEY) return NextResponse.json({ urls: [], error: "No API key" });

  try {
    if (count <= UNSPLASH_MAX) {
      return NextResponse.json({ urls: await fetchRandomPhotos(count) });
    }
    // Split into parallel requests
    const [batch1, batch2] = await Promise.all([
      fetchRandomPhotos(UNSPLASH_MAX),
      fetchRandomPhotos(count - UNSPLASH_MAX),
    ]);
    return NextResponse.json({ urls: [...batch1, ...batch2] });
  } catch (e: any) {
    return NextResponse.json({ urls: [], error: e.message });
  }
}
