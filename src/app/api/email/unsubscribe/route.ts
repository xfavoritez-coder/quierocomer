import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  const restaurant = await prisma.restaurant.findUnique({ where: { slug }, select: { id: true, name: true } });
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.restaurant.update({ where: { id: restaurant.id }, data: { weeklyEmailEnabled: false } });

  const url = new URL("/email-unsub", req.url);
  url.searchParams.set("name", restaurant.name);
  url.searchParams.set("slug", slug);
  url.searchParams.set("action", "done");
  return NextResponse.redirect(url);
}
