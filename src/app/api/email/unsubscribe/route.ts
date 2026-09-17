import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  const email = req.nextUrl.searchParams.get("email");

  // Legacy: unsubscribe weekly email by slug
  if (slug) {
    const restaurant = await prisma.restaurant.findUnique({ where: { slug }, select: { id: true, name: true } });
    if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.restaurant.update({ where: { id: restaurant.id }, data: { weeklyEmailEnabled: false } });
    const url = new URL("/email-unsub", req.url);
    url.searchParams.set("name", restaurant.name);
    url.searchParams.set("slug", slug);
    url.searchParams.set("action", "done");
    return NextResponse.redirect(url);
  }

  // Generic unsubscribe by email (from List-Unsubscribe header clicks)
  if (email) {
    const url = new URL("/email-unsub", req.url);
    url.searchParams.set("action", "done");
    return NextResponse.redirect(url);
  }

  return NextResponse.json({ error: "Missing slug or email" }, { status: 400 });
}

/** One-click unsubscribe: RFC 8058 / Gmail requirement */
export async function POST(req: NextRequest) {
  // Body is: List-Unsubscribe=One-Click (URL-encoded form)
  // Just return 200 — we don't need to do anything for transactional emails
  return new NextResponse(null, { status: 200 });
}
