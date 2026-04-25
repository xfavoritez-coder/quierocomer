import { NextResponse } from "next/server";

const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;

// Simple endpoint: receives a search query, returns one Unsplash photo
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  if (!query) return NextResponse.json({ url: null });
  if (!UNSPLASH_KEY) return NextResponse.json({ url: null, error: "No API key" });

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query + " food dish")}&per_page=1&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } }
    );
    if (!res.ok) return NextResponse.json({ url: null, error: `Unsplash ${res.status}` });
    const data = await res.json();
    return NextResponse.json({ url: data.results?.[0]?.urls?.regular || null });
  } catch (e: any) {
    return NextResponse.json({ url: null, error: e.message });
  }
}
