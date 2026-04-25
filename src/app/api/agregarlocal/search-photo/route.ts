import { NextResponse } from "next/server";

const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;

// Batch endpoint: fetch N random food photos in a single Unsplash call
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const count = Math.min(Number(searchParams.get("count")) || 1, 30);
  if (!UNSPLASH_KEY) return NextResponse.json({ urls: [], error: "No API key" });

  try {
    const res = await fetch(
      `https://api.unsplash.com/photos/random?query=food+dish+restaurant&count=${count}&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } }
    );
    if (!res.ok) return NextResponse.json({ urls: [], error: `Unsplash ${res.status}` });
    const data = await res.json();
    const urls = (Array.isArray(data) ? data : [data]).map((p: any) => p?.urls?.regular).filter(Boolean);
    return NextResponse.json({ urls });
  } catch (e: any) {
    return NextResponse.json({ urls: [], error: e.message });
  }
}
