import { NextResponse } from "next/server";

export const maxDuration = 10;

/**
 * POST /api/subircarta/check-url
 * Quick HEAD check to verify a URL is reachable (~3s timeout).
 * Non-blocking: used for UI feedback only, doesn't prevent submission.
 */
export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ reachable: false });
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json({ reachable: false });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    try {
      const res = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; QuieroComer/1.0)" },
        redirect: "follow",
      });
      clearTimeout(timer);
      return NextResponse.json({ reachable: res.ok || res.status === 405 });
    } catch {
      clearTimeout(timer);
      // HEAD failed, try GET with minimal read
      try {
        const controller2 = new AbortController();
        const timer2 = setTimeout(() => controller2.abort(), 3000);
        const res = await fetch(url, {
          method: "GET",
          signal: controller2.signal,
          headers: { "User-Agent": "Mozilla/5.0 (compatible; QuieroComer/1.0)" },
          redirect: "follow",
        });
        clearTimeout(timer2);
        res.body?.cancel();
        return NextResponse.json({ reachable: res.ok });
      } catch {
        return NextResponse.json({ reachable: false });
      }
    }
  } catch {
    return NextResponse.json({ reachable: false });
  }
}
